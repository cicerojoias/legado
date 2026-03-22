import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { WhatsAppError } from '@/lib/whatsapp/errors'
import { getCachedMediaUrl, setMediaUrlCache } from '@/lib/whatsapp/media-cache'

const BASE_URL = 'https://graph.facebook.com/v22.0'

interface RouteParams {
  params: Promise<{ mediaId: string }>
}

/**
 * GET /api/whatsapp/media/[mediaId]
 *
 * Proxy autenticado para mídias inbound do WhatsApp.
 * Obtém uma URL assinada fresh da Meta e faz stream do binário ao cliente.
 * A Meta mantém a mídia por ~30 dias — o mediaId não expira, apenas a URL assinada.
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
    // Passo 1: Resolver a URL de download assinada (expira em ~5 min)
    // Primeiro, verificar cache (reduz calls à Meta em 20-30%)
    let url: string
    let mime_type: string

    const cached = getCachedMediaUrl(mediaId)
    if (cached) {
      console.log(`[media-proxy] Cache hit for ${mediaId}`)
      url = cached.url
      mime_type = cached.mimeType
    } else {
      // Cache miss: fetch fresh from Meta
      console.log(`[media-proxy] Cache miss for ${mediaId}, fetching from Meta`)
      const metaRes = await fetch(`${BASE_URL}/${mediaId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!metaRes.ok) {
        const err = await metaRes.text()
        console.error(`[media-proxy] Meta API error ${metaRes.status}:`, err)
        throw new WhatsAppError('MEDIA_NOT_FOUND', 'Mídia não encontrada ou expirada')
      }

      const data = (await metaRes.json()) as { url: string; mime_type: string }
      url = data.url
      mime_type = data.mime_type

      // Cache para próximas requisições
      setMediaUrlCache(mediaId, url, mime_type)
    }

    // Passo 2: Baixar o binário da Meta com autenticação
    const mediaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!mediaRes.ok) {
      throw new WhatsAppError('UPLOAD_FAILED', 'Falha ao baixar mídia da Meta')
    }

    // Passo 3: Stream direto ao browser com cache de 1h (a URL proxy é estável)
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
