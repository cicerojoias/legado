import { mensagemErroWhatsApp } from '@/lib/whatsapp/errors'
import { prisma } from '@/lib/prisma'
import { sendTextMessage } from '@/lib/whatsapp/meta-client'
import { createClient } from '@/lib/supabase/server'
import { createServerTiming } from '@/lib/server-timing'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const timing = createServerTiming('api/whatsapp/send')
  const supabase = await createClient()
  const { data: { user } } = await timing.measure('auth', supabase.auth.getUser())
  if (!user) return new Response('Unauthorized', { status: 401 })

  try {
    const body = await req.json() as {
      clientId?: string
      conversationId: string
      text: string
      replyToId?: string
      replyToSnapshot?: string
    }
    const { clientId, conversationId, text, replyToId, replyToSnapshot } = body

    if (!conversationId || !text?.trim()) {
      return Response.json({ error: 'conversationId e text são obrigatórios' }, { status: 400 })
    }
    // id gerado no browser para a bolha otimista — o realtime deduplica pelo mesmo id
    if (clientId !== undefined && !UUID_RE.test(clientId)) {
      return Response.json({ error: 'clientId inválido' }, { status: 400 })
    }

    // Telefone do contato e wa_message_id da mensagem citada (context da Meta) em paralelo
    const [conversation, replyMsg] = await timing.measure('lookup', Promise.all([
      prisma.waConversation.findUnique({
        where: { id: conversationId },
        select: { contact: { select: { phone: true } } },
      }),
      replyToId
        ? prisma.waMessage.findUnique({ where: { id: replyToId }, select: { wa_message_id: true } })
        : null,
    ]))

    if (!conversation) {
      return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const now = new Date()
    const contextWaMessageId = replyMsg?.wa_message_id ?? undefined

    // Persistir primeiro como pendente para que o realtime publique a linha imediatamente.
    const draft = await timing.measure('draft', prisma.waMessage.create({
      data: {
        ...(clientId ? { id: clientId } : {}),
        conversation_id: conversationId,
        direction: 'outbound',
        type: 'text',
        content: text.trim(),
        status: 'pending',
        sent_by: user.id,
        timestamp: now,
        replyToId: replyToId ?? null,
        replyToSnapshot: replyToSnapshot ? replyToSnapshot.slice(0, 500) : null,
      },
    }))

    // Reordenação da lista não precisa esperar a Meta (e vice-versa)
    const touchConversation = timing.measure('touch-conv', prisma.waConversation.update({
      where: { id: conversationId },
      data: { last_message_at: now },
    })).catch((err) => console.error('[send] Falha ao atualizar last_message_at:', err))

    try {
      // Enviar via Meta Cloud API
      const [waMessageId] = await Promise.all([
        timing.measure('meta', sendTextMessage(
          conversation.contact.phone,
          text.trim(),
          contextWaMessageId
        )),
        touchConversation,
      ])

      // Consolidar a mensagem já exibida como "pending" para o status final.
      const message = await timing.measure('finalize', prisma.waMessage.update({
        where: { id: draft.id },
        data: {
          wa_message_id: waMessageId || undefined,
          status: 'sent',
        },
      }))

      timing.log()
      return Response.json({ message }, { headers: { 'Server-Timing': timing.header() } })
    } catch (error: unknown) {
      await touchConversation
      await prisma.waMessage.update({
        where: { id: draft.id },
        data: { status: 'failed' },
      }).catch(() => {})

      console.error('=== ERRO NO ENVIO OUTBOUND (Meta/WhatsApp): ===')
      console.error(error)
      return Response.json(
        { error: mensagemErroWhatsApp(error, 'Erro ao enviar a mensagem.') },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    console.error('[send] Erro:', error)
    return Response.json(
      { error: 'Erro ao enviar a mensagem.' },
      { status: 500 }
    )
  }
}
