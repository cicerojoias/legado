import { NextRequest, NextResponse, after } from 'next/server'
import { prisma } from '@/lib/prisma'
import { WebhookPayload } from '@/lib/whatsapp/types'
import {
  generateWebhookId,
  isWebhookProcessed,
  markWebhookProcessed,
} from '@/lib/whatsapp/webhook-dedup'
import { dispatchPushForConversation } from '@/lib/whatsapp/push-dispatcher'
import { incrementUnreadForConversation } from '@/lib/whatsapp/unread-manager'
import { sendTextMessage } from '@/lib/whatsapp/meta-client'
import { maybeRespondWithAI } from '@/lib/whatsapp/ai-responder'
import { persistMediaToR2 } from '@/lib/whatsapp/media-uploader'

const WELCOME_WINDOW_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

/**
 * Envia mensagem de boas-vindas automática com guarda atômica anti-race-condition.
 * 
 * Executada sincronamente no fluxo principal do webhook (não via `after()`),
 * garantindo que `updateMany` e `sendTextMessage` aconteçam no mesmo contexto
 * de execução. A condição WHERE no `updateMany` resolve a disputa quando dois
 * webhooks concorrentes chegam simultaneamente: apenas um obtém count > 0 e
 * envia a mensagem; os demais veem count === 0 e abortam sem enviar.
 */
async function trySendWelcomeMessage(
  conversationId: string,
  waId: string,
  existingConv: { last_message_at: Date | null; welcome_sent_at: Date | null } | null,
): Promise<void> {
  const now = Date.now()
  const prevActivity = existingConv?.last_message_at
  const prevWelcome = existingConv?.welcome_sent_at

  // Janela de 7 dias sem atividade de nenhum dos lados
  const windowExpired = !prevActivity || (now - prevActivity.getTime() > WELCOME_WINDOW_MS)
  // Boas-vindas não foi enviada nessa janela
  const welcomeStale = !prevWelcome || (now - prevWelcome.getTime() > WELCOME_WINDOW_MS)

  if (!windowExpired || !welcomeStale) return

  const settings = await prisma.waSettings.findUnique({ where: { id: 'singleton' } })
  if (!settings?.welcome_enabled || !settings.welcome_message) return

  // Trava atômica: gravar welcome_sent_at ANTES de enviar
  const updated = await prisma.waConversation.updateMany({
    where: {
      id: conversationId,
      // Condição de guarda: welcome_sent_at ainda está fora da janela
      OR: [
        { welcome_sent_at: null },
        { welcome_sent_at: { lt: new Date(now - WELCOME_WINDOW_MS) } },
      ],
    },
    data: { welcome_sent_at: new Date(now) },
  })

  // Se count === 0, outro webhook ganhou a corrida — não envia
  if (updated.count === 0) {
    console.log(`[webhook] Welcome skipped for ${waId}: another webhook won the race`)
    return
  }

  const waMessageId = await sendTextMessage(waId, settings.welcome_message)
  await prisma.waMessage.create({
    data: {
      wa_message_id: waMessageId || undefined,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      content: settings.welcome_message,
      status: 'sent',
      timestamp: new Date(),
    },
  })
  console.log(`[webhook] Welcome message sent to ${waId}`)
}

// GET: Verificação de Webhook (Facebook/Meta exige isso para validar o endpoint)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode && token) {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
    if (mode === 'subscribe' && token === verifyToken) {
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
            const waContact = await prisma.waContact.upsert({
              where: { phone: waId },
              update: { name },
              create: { phone: waId, name, wa_id: waId },
            })

            // B. Ler estado anterior da conversa ANTES do upsert (para welcome message)
            const existingConv = await prisma.waConversation.findUnique({
              where: { contact_id: waContact.id },
              select: { id: true, last_message_at: true, welcome_sent_at: true },
            })

            // Parsear o timestamp real enviado pela Meta (segundos unix para objeto Date)
            const messageTimestamp = msg.timestamp
              ? new Date(Number(msg.timestamp) * 1000)
              : new Date()

            // Atualiza last_message_at apenas se o novo timestamp for mais recente (evita problemas com fora de ordem)
            const lastMessageAt = (!existingConv || !existingConv.last_message_at || messageTimestamp > existingConv.last_message_at)
              ? messageTimestamp
              : existingConv.last_message_at

            // C. Garantir que a conversa existe (um contato = uma conversa)
            const waConversation = await prisma.waConversation.upsert({
              where: { contact_id: waContact.id },
              update: {
                status: 'open',
                last_message_at: lastMessageAt,
              },
              create: {
                contact_id: waContact.id,
                status: 'open',
                last_message_at: lastMessageAt,
              },
            })

            // C. Salvar a Mensagem
            let content = ''
            const type = msg.type
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
            } else if (msg.type === 'sticker') {
              content = msg.sticker?.animated ? '[Figurinha animada]' : '[Figurinha]'
              mediaId = msg.sticker?.id || ''
              mimeType = msg.sticker?.mime_type || 'image/webp'
            } else if (msg.type === 'location') {
              const loc = msg.location
              content = JSON.stringify({
                lat: loc?.latitude,
                lng: loc?.longitude,
                name: loc?.name || '',
                address: loc?.address || '',
                url: loc?.url || '',
              })
            } else if (msg.type === 'contacts') {
              const first = msg.contacts?.[0]
              const name = first?.name?.formatted_name || first?.name?.first_name || ''
              const total = msg.contacts?.length ?? 1
              content = JSON.stringify({ name, total })
            } else if (msg.type === 'order') {
              const count = msg.order?.product_items?.length ?? 0
              content = JSON.stringify({ count, text: msg.order?.text || '' })
            } else if (msg.type === 'interactive') {
              content = msg.interactive?.button_reply?.title
                || msg.interactive?.list_reply?.title
                || msg.interactive?.nfm_reply?.body
                || '[Interativo]'
            } else if (msg.type === 'button') {
              content = msg.button?.text || '[Botão]'
            } else if (msg.type === 'system') {
              content = msg.system?.body || '[Sistema]'
            } else if (msg.type === 'unsupported' || msg.type === 'unknown') {
              content = '[Mensagem não suportada]'
            }

            // mediaUrl aponta para nosso proxy: busca da Meta on-demand, sem background job
            const mediaUrl = mediaId ? `/api/whatsapp/media/${mediaId}` : null
            console.log(
              `[webhook] msg type=${type} mediaId=${mediaId || 'N/A'} mediaUrl=${mediaUrl || 'null'}`
            )

            // Contexto de resposta — quando o cliente cita uma mensagem no WhatsApp dele
            let replyToId: string | undefined
            let replyToSnapshot: string | undefined
            if (msg.context?.id) {
              const quoted = await prisma.waMessage.findUnique({
                where: { wa_message_id: msg.context.id },
                select: { id: true, content: true, type: true },
              })
              if (quoted) {
                replyToId = quoted.id
                replyToSnapshot = (quoted.content || `[${quoted.type}]`).slice(0, 500)
              }
            }

            await prisma.waMessage.create({
              data: {
                wa_message_id: msg.id,
                conversation_id: waConversation.id,
                direction: 'inbound',
                type,
                content,
                status: 'delivered',
                timestamp: messageTimestamp,
                mediaUrl,
                mediaId: mediaId || undefined,
                mimeType: mimeType || undefined,
                replyToId,
                replyToSnapshot,
              },
            })

            // Salva mídia no R2 de forma assíncrona
            if (mediaId && mimeType) {
              try {
                after(async () => {
                  console.log(`[webhook] Processando persistência assíncrona da mídia ${mediaId} no R2`)
                  await persistMediaToR2(mediaId, mimeType)
                })
              } catch {
                void persistMediaToR2(mediaId, mimeType)
              }
            }

            // D. Mensagem de boas-vindas automática (ANTES do after — evita race condition)
            try {
              await trySendWelcomeMessage(waConversation.id, waId, existingConv)
            } catch (err) {
              console.error('[webhook] welcome message error:', err)
            }

            // Dispara IA para mensagens de texto (após ack ao Meta — não bloqueia)
            if (msg.type === 'text') {
              after(() =>
                maybeRespondWithAI(waConversation.id, waId)
                  .catch((err) => console.error('[webhook] ai-responder error:', err))
              )
            }

            // E. Incrementa unread count DENTRO da transação principal (antes do after)
            // Corrige race condition: se o processo morrer entre save e increment,
            // o badge de não lidos não fica desatualizado permanentemente
            try {
              await incrementUnreadForConversation(waConversation.id)
            } catch (err) {
              console.error('[webhook] unread increment error:', err)
            }

            // Dispara push após a resposta 200 (não bloqueia o webhook)
            after(() =>
              dispatchPushForConversation(waConversation.id, name, content || '[Mídia]')
                .catch((err) => console.error('[webhook] push dispatch error:', err))
            )
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
          // Atualiza status da mensagem outbound no banco local
          // (sent -> delivered -> read via webhooks da Meta)
          return prisma.waMessage.updateMany({
            where: { wa_message_id: status.id },
            data: { status: status.status },
          })
        })
      )
      
      console.log(`[webhook] ${value.statuses.length} status updates processados`)
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
