import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WebhookPayload } from '@/lib/whatsapp/types'

// GET: Verificação de Webhook (Facebook/Meta exige isso para validar o endpoint)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('WEBHOOK_VERIFIED')
      return new Response(challenge, { status: 200 })
    } else {
      return new Response('Forbidden', { status: 403 })
    }
  }

  return new Response('Not Found', { status: 404 })
}

// POST: Recebimento de eventos (mensagens, status, etc)
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as WebhookPayload
    
    // Validar se é uma notificação do WhatsApp
    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Not a WhatsApp webhook' }, { status: 404 })
    }

    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value

    if (!value) return NextResponse.json({ status: 'ok' })

    // 1. Processar Mensagens (messages)
    if (value.messages && value.messages.length > 0) {
      for (const msg of value.messages) {
        const contactInfo = value.contacts?.find(c => c.wa_id === msg.from)
        const waId = msg.from
        const name = contactInfo?.profile?.name || waId

        // A. Garantir que o contato existe
        let waContact = await (prisma as any).waContact.upsert({
          where: { phone: waId },
          update: { name },
          create: { phone: waId, name, wa_id: waId }
        })

        // B. Garantir que a conversa existe (um contato = uma conversa)
        let waConversation = await (prisma as any).waConversation.upsert({
          where: { contact_id: waContact.id },
          update: {
            status: 'open',
            last_message_at: new Date()
          },
          create: {
            contact_id: waContact.id,
            status: 'open',
            last_message_at: new Date()
          }
        })

        // C. Salvar a Mensagem
        let content = ''
        let type = msg.type
        let mediaId = ''
        let mimeType = ''

        if (msg.type === 'text') {
          content = msg.text?.body || ''
        } else if (msg.type === 'image') {
          content = msg.image?.caption || '[Imagem]'
          mediaId = msg.image?.id || ''
          mimeType = msg.image?.mime_type || ''
        } else if (msg.type === 'audio') {
          content = '[Áudio]'
          mediaId = msg.audio?.id || ''
          mimeType = msg.audio?.mime_type || ''
        } else if (msg.type === 'video') {
          content = msg.video?.caption || '[Vídeo]'
          mediaId = msg.video?.id || ''
          mimeType = msg.video?.mime_type || ''
        } else if (msg.type === 'document') {
          content = msg.document?.filename || '[Documento]'
          mediaId = msg.document?.id || ''
          mimeType = msg.document?.mime_type || ''
        }

        // mediaUrl aponta para nosso proxy: busca da Meta on-demand, sem background job
        const mediaUrl = mediaId ? `/api/whatsapp/media/${mediaId}` : null
        console.log(`[webhook] msg type=${type} mediaId=${mediaId || 'N/A'} mediaUrl=${mediaUrl || 'null'}`)

        await (prisma as any).waMessage.create({
          data: {
            wa_message_id: msg.id,
            conversation_id: waConversation.id,
            direction: 'inbound',
            type,
            content,
            status: 'delivered',
            timestamp: new Date(),
            mediaUrl,
            mediaId: mediaId || undefined,
            mimeType: mimeType || undefined
          }
        })
      }
    }

    // 2. Processar Status (statuses) - Confirmação de leitura/entrega
    if (value.statuses && value.statuses.length > 0) {
      for (const status of value.statuses) {
        await (prisma as any).waMessage.updateMany({
          where: { wa_message_id: status.id },
          data: { status: status.status }
        })
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('Webhook Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
