import { prisma } from '@/lib/prisma'
import { validateSignature } from '@/lib/whatsapp/validate-signature'
import { parseInboundMessages, parseStatusUpdates } from '@/lib/whatsapp/webhook-parser'
import { markAsRead } from '@/lib/whatsapp/meta-client'
import type { MetaWebhookPayload } from '@/lib/whatsapp/types'

// ─── GET — Verificação do webhook pela Meta ───────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('[webhook] Verificação OK')
    return new Response(challenge, { status: 200 })
  }

  console.warn('[webhook] Verificação falhou — token inválido')
  return new Response('Forbidden', { status: 403 })
}

// ─── POST — Receber mensagens e status updates ────────────────────────────────

export async function POST(req: Request) {
  // 1. Ler o body bruto para validar a assinatura (parse depois)
  const rawBody = await req.text()
  const signature = req.headers.get('x-hub-signature-256') ?? ''

  if (!validateSignature(rawBody, signature)) {
    console.warn('[webhook] Assinatura inválida — requisição rejeitada')
    return new Response('Unauthorized', { status: 401 })
  }

  // 2. Parse do payload
  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Responder imediatamente — a Meta exige resposta em < 20s
  // Processar em background sem await (Edge não suporta waitUntil nativo)
  processPayload(payload).catch((err) =>
    console.error('[webhook] Erro ao processar payload:', err)
  )

  return new Response('OK', { status: 200 })
}

// ─── Processamento assíncrono ─────────────────────────────────────────────────

async function processPayload(payload: MetaWebhookPayload) {
  // Processar mensagens recebidas
  const messages = parseInboundMessages(payload)
  for (const msg of messages) {
    await upsertMessage(msg)
  }

  // Processar atualizações de status (delivered, read, etc.)
  const statusUpdates = parseStatusUpdates(payload)
  for (const update of statusUpdates) {
    await updateMessageStatus(update.waMessageId, update.status)
  }
}

async function upsertMessage(msg: Awaited<ReturnType<typeof parseInboundMessages>>[number]) {
  // 1. Upsert do contato
  const contact = await prisma.waContact.upsert({
    where: { phone: msg.phone },
    update: { name: msg.name ?? undefined, wa_id: msg.waId },
    create: { phone: msg.phone, name: msg.name, wa_id: msg.waId },
  })

  // 2. Upsert da conversa (uma por contato; a mais recente)
  let conversation = await prisma.waConversation.findFirst({
    where: { contact_id: contact.id, status: { not: 'resolved' } },
    orderBy: { created_at: 'desc' },
  })

  if (!conversation) {
    conversation = await prisma.waConversation.create({
      data: { contact_id: contact.id, last_message_at: msg.timestamp },
    })
  }

  // 3. Insert da mensagem (idempotente via wa_message_id único)
  const existing = await prisma.waMessage.findUnique({
    where: { wa_message_id: msg.waMessageId },
  })

  if (existing) {
    console.log(`[webhook] Mensagem duplicada ignorada: ${msg.waMessageId}`)
    return
  }

  await prisma.waMessage.create({
    data: {
      conversation_id: conversation.id,
      wa_message_id: msg.waMessageId,
      direction: 'inbound',
      type: msg.type,
      content: msg.content,
      timestamp: msg.timestamp,
    },
  })

  // 4. Atualizar last_message_at da conversa
  await prisma.waConversation.update({
    where: { id: conversation.id },
    data: { last_message_at: msg.timestamp },
  })

  // 5. Marcar como lida automaticamente (double check azul para o cliente)
  await markAsRead(msg.waMessageId)

  console.log(`[webhook] Mensagem de ${msg.phone} salva`)
}

async function updateMessageStatus(waMessageId: string, status: string) {
  await prisma.waMessage.updateMany({
    where: { wa_message_id: waMessageId },
    data: { status },
  })
}
