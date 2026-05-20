import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { WhatsAppError } from '@/lib/whatsapp/errors'
import { getCachedMediaUrl, setMediaUrlCache } from '@/lib/whatsapp/media-cache'
import { isR2Configured, checkFileExistsInR2, getFileFromR2 } from '@/lib/whatsapp/r2-client'
import { getR2Key, persistMediaToR2 } from '@/lib/whatsapp/media-uploader'

const BASE_URL = 'https://graph.facebook.com/v22.0'

interface RouteParams {
  params: Promise<{ mediaId: string }>
}

/**
 * GET /api/whatsapp/media/[mediaId]
 *
 * Proxy autenticado para mídias inbound do WhatsApp.
 * 1. Tenta buscar a mídia permanentemente do Cloudflare R2.
 * 2. Caso não exista no R2, busca da Meta e inicia upload em background para o R2.
 */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const error = new WhatsAppError('UNAUTHORIZED', 'Não autorizado')
    return new Response(JSON.stringify(error.toJSON()), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  const { mediaId } = await params
  const token = process.env.WHATSAPP_TOKEN
  if (!token) {
    const error = new WhatsAppError('INTERNAL_ERROR', 'Configuração de servidor inválida', 503)
    return new Response(JSON.stringify(error.toJSON()), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    // 1. Tentar buscar do Cloudflare R2 primeiro (se configurado)
    if (isR2Configured()) {
      // Procurar mimeType correspondente no banco
      const msg = await prisma.waMessage.findFirst({
        where: { mediaId },
        select: { mimeType: true },
      })
      const mimeType = msg?.mimeType || 'image/jpeg' // fallback padrão
      const key = getR2Key(mediaId, mimeType)

      const exists = await checkFileExistsInR2(key)
      if (exists) {
        console.log(`[media-proxy] Servindo mídia ${mediaId} diretamente do Cloudflare R2`)
        const file = await getFileFromR2(key)
        if (file && file.body) {
          return new Response(file.body, {
            headers: {
              'Content-Type': file.contentType || mimeType,
              'Cache-Control': 'private, max-age=31536000, immutable', // Cache agressivo, o R2 é permanente
            },
          })
        }
      }
    }

    // 2. Fallback: Buscar da Meta
    console.log(`[media-proxy] Cache miss no R2 para ${mediaId}, buscando na Meta...`)
    
    let url: string
    let mime_type: string

    const cached = getCachedMediaUrl(mediaId)
    if (cached) {
      console.log(`[media-proxy] Cache hit da Meta no cache em memória para ${mediaId}`)
      url = cached.url
      mime_type = cached.mimeType
    } else {
      const metaRes = await fetch(`${BASE_URL}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!metaRes.ok) {
        const err = await metaRes.text()
        console.error(`[media-proxy] Meta API error ${metaRes.status}:`, err)
        throw new WhatsAppError('MEDIA_NOT_FOUND', 'Mídia não encontrada ou expirada na Meta')
      }

      const data = (await metaRes.json()) as { url: string; mime_type: string }
      url = data.url
      mime_type = data.mime_type

      // Cache em memória temporário
      setMediaUrlCache(mediaId, url, mime_type)
    }

    // Baixar da Meta
    const mediaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!mediaRes.ok) {
      throw new WhatsAppError('UPLOAD_FAILED', 'Falha ao baixar mídia da Meta')
    }

    // Disparar o upload para o R2 em background de forma assíncrona
    if (isR2Configured()) {
      console.log(`[media-proxy] Disparando persistência assíncrona para o R2 da mídia ${mediaId}`)
      void persistMediaToR2(mediaId, mime_type)
    }

    // Retornar stream para o browser
    return new Response(mediaRes.body, {
      headers: {
        'Content-Type': mime_type || 'application/octet-stream',
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    if (error instanceof WhatsAppError) {
      return new Response(JSON.stringify(error.toJSON()), { status: error.statusCode, headers: { 'Content-Type': 'application/json' } })
    }

    const msg = error instanceof Error ? error.message : String(error)
    console.error('[media-proxy] Erro desconhecido:', msg)
    const genericError = new WhatsAppError('INTERNAL_ERROR', 'Erro ao processar sua solicitação')
    return new Response(JSON.stringify(genericError.toJSON()), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
