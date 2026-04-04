import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WebhookPayload } from '@/lib/whatsapp/types'
import { WhatsAppError } from '@/lib/whatsapp/errors'
import {
  generateWebhookId,
  isWebhookProcessed,
  markWebhookProcessed,
} from '@/lib/whatsapp/webhook-dedup'
import { dispatchPushForConversation } from '@/lib/whatsapp/push-dispatcher'
import { incrementUnreadForConversation } from '@/lib/whatsapp/unread-manager'
import { sendTextMessage } from '@/lib/whatsapp/meta-client'

const WELCOME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

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

    if (!value || !entry || !changes) return NextResponse.json({ status: 'ok' })

    // ──────────────────────────────────────────────────────────────────────
    // PHASE 2: Deduplication
    // Gerar webhook ID e verificar se já foi processado
    // ──────────────────────────────────────────────────────────────────────
    const messageIds = value.messages?.map(m => m.id) || []
    const webhookId = generateWebhookId(entry.id, changes.field, messageIds)

    if (isWebhookProcessed(webhookId)) {
      console.log(`[webhook] Webhook duplicate ignored: ${webhookId}`)
      return NextResponse.json({ status: 'already_processed' })
    }

    // 1. Processar Mensagens (messages) — Batch processing
    if (value.messages && value.messages.length > 0) {
      // ────────────────────────────────────────────────────────────────────
      // PHASE 2: Batch Processing
      // Processar múltiplas mensagens em paralelo ao invés de sequencial
      // Impacto: 3-5x mais rápido em webhooks com múltiplas mensagens
      // ────────────────────────────────────────────────────────────────────
      await Promise.all(
        value.messages.map(async (msg) => {
          try {
            // Reação — atualiza mensagem-alvo sem criar nova mensagem/conversa
            if (msg.type === 'reaction') {
              const targetWaId = msg.reaction?.message_id
              const emoji = msg.reaction?.emoji || null
              if (targetWaId) {
                await prisma.waMessage.updateMany({
                  where: { wa_message_id: targetWaId },
                  data: { reaction: emoji || null },
                })
              }
              return
            }

            const contactInfo = value.contacts?.find(c => c.wa_id === msg.from)
            const waId = msg.from
            const name = contactInfo?.profile?.name || waId

            // A. Garantir que o contato existe
            let waContact = await prisma.waContact.upsert({
              where: { phone: waId },
              update: { name },
              create: { phone: waId, name, wa_id: waId },
            })

            // B. Ler estado anterior da conversa ANTES do upsert (para welcome message)
            const existingConv = await prisma.waConversation.findUnique({
              where: { contact_id: waContact.id },
              select: { id: true, last_message_at: true, welcome_sent_at: true },
            })

            // C. Garantir que a conversa existe (um contato = uma conversa)
            let waConversation = await prisma.waConversation.upsert({
              where: { contact_id: waContact.id },
              update: {
                status: 'open',
                last_message_at: new Date(),
              },
              create: {
                contact_id: waContact.id,
                status: 'open',
                last_message_at: new Date(),
              },
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
            console.log(
              `[webhook] msg type=${type} mediaId=${mediaId || 'N/A'} mediaUrl=${mediaUrl || 'null'}`
            )

            await prisma.waMessage.create({
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
                mimeType: mimeType || undefined,
              },
            })

            // Dispara push e incrementa unreads após a resposta 200 (não bloqueia o webhook)
            after(() =>
              dispatchPushForConversation(waConversation.id, name, content || '[Mídia]')
                .catch((err) => console.error('[webhook] push dispatch error:', err))
            )
            after(() =>
              incrementUnreadForConversation(waConversation.id)
                .catch((err) => console.error('[webhook] unread increment error:', err))
            )

            // D. Mensagem de boas-vindas automática
            after(async () => {
              try {
                const now = Date.now()
                const prevActivity = existingConv?.last_message_at
                const prevWelcome  = existingConv?.welcome_sent_at

                // Janela de 7 dias sem atividade de nenhum dos lados
                const windowExpired = !prevActivity || (now - prevActivity.getTime() > WELCOME_WINDOW_MS)
                // Boas-vindas não foi enviada nessa janela
                const welcomeStale  = !prevWelcome  || (now - prevWelcome.getTime()  > WELCOME_WINDOW_MS)

                if (!windowExpired || !welcomeStale) return

                const settings = await prisma.waSettings.findUnique({ where: { id: 'singleton' } })
                if (!settings?.welcome_enabled || !settings.welcome_message) return

                // Trava atômica: gravar welcome_sent_at ANTES de enviar para evitar race condition
                const updated = await prisma.waConversation.updateMany({
                  where: {
                    id: waConversation.id,
                    // Condição de guarda: welcome_sent_at ainda está fora da janela
                    OR: [
                      { welcome_sent_at: null },
                      { welcome_sent_at: { lt: new Date(now - WELCOME_WINDOW_MS) } },
                    ],
                  },
                  data: { welcome_sent_at: new Date(now) },
                })

                // Se count === 0, outro processo ganhou a corrida — não envia
                if (updated.count === 0) return

                const waMessageId = await sendTextMessage(waId, settings.welcome_message)
                await prisma.waMessage.create({
                  data: {
                    wa_message_id: waMessageId || undefined,
                    conversation_id: waConversation.id,
                    direction: 'outbound',
                    type: 'text',
                    content: settings.welcome_message,
                    status: 'sent',
                    timestamp: new Date(),
                  },
                })
                console.log(`[webhook] Welcome message sent to ${waId}`)
              } catch (err) {
                console.error('[webhook] welcome message error:', err)
              }
            })
          } catch (msgError) {
            console.error(`[webhook] Error processing message ${msg.id}:`, msgError)
            // Continue processing other messages instead of failing entire webhook
          }
        })
      )
    }

    // 2. Processar Status (statuses) - Confirmação de leitura/entrega — Batch
    if (value.statuses && value.statuses.length > 0) {
      // Batch update de status ao invés de um por um
      await Promise.all(
        value.statuses.map((status) => {
          if (status.status === 'failed' && status.errors?.length) {
            console.error('[webhook] Meta entrega falhou', {
              waMessageId: status.id,
              recipientId: status.recipient_id,
              errors: JSON.stringify(status.errors),
            })
          }
          return prisma.waMessage.updateMany({
            where: { wa_message_id: status.id },
            data: { status: status.status },
          })
        })
      )
    }

    // ────────────────────────────────────────────────────────────────────
    // PHASE 2: Marca webhook como processado
    // ────────────────────────────────────────────────────────────────────
    markWebhookProcessed(webhookId)

    return NextResponse.json({ status: 'ok' })
  } catch (err) {
    console.error('Webhook Error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
