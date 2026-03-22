import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { mediaId } = await params
  const token = process.env.WHATSAPP_TOKEN
  if (!token) return new Response('WHATSAPP_TOKEN não configurado', { status: 503 })

  // Passo 1: Resolver a URL de download assinada (expira em ~5 min, então buscamos fresh)
  const metaRes = await fetch(`${BASE_URL}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!metaRes.ok) {
    const err = await metaRes.text()
    console.error(`[media-proxy] Meta API error ${metaRes.status}:`, err)
    return new Response('Mídia não encontrada ou expirada', { status: 404 })
  }

  const { url, mime_type } = (await metaRes.json()) as { url: string; mime_type: string }

  // Passo 2: Baixar o binário da Meta com autenticação
  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!mediaRes.ok) {
    return new Response('Falha ao baixar mídia da Meta', { status: 502 })
  }

  // Passo 3: Stream direto ao browser com cache de 1h (a URL proxy é estável)
  return new Response(mediaRes.body, {
    headers: {
      'Content-Type': mime_type || 'application/octet-stream',
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
