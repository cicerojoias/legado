import { prisma } from '@/lib/prisma'
import { sendTextMessage } from '@/lib/whatsapp/meta-client'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  try {
    const body = await req.json() as {
      conversationId: string
      text: string
      replyToId?: string
      replyToSnapshot?: string
    }
    const { conversationId, text, replyToId, replyToSnapshot } = body

    if (!conversationId || !text?.trim()) {
      return Response.json({ error: 'conversationId e text são obrigatórios' }, { status: 400 })
    }

    // Buscar a conversa + contato para obter telefone
    const conversation = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    })

    if (!conversation) {
      return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const now = new Date()

    // Resolver wa_message_id da mensagem citada (necessário para o campo context da Meta)
    let contextWaMessageId: string | undefined
    if (replyToId) {
      const replyMsg = await prisma.waMessage.findUnique({
        where: { id: replyToId },
        select: { wa_message_id: true },
      })
      contextWaMessageId = replyMsg?.wa_message_id ?? undefined
    }

    // Persistir primeiro como pendente para que o realtime publique a linha imediatamente.
    const draft = await prisma.waMessage.create({
      data: {
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
    })

    await prisma.waConversation.update({
      where: { id: conversationId },
      data: { last_message_at: now },
    })

    try {
      // Enviar via Meta Cloud API
      const waMessageId = await sendTextMessage(
        conversation.contact.phone,
        text.trim(),
        contextWaMessageId
      )

      // Consolidar a mensagem já exibida como "pending" para o status final.
      const message = await prisma.waMessage.update({
        where: { id: draft.id },
        data: {
          wa_message_id: waMessageId || undefined,
          status: 'sent',
        },
      })

      return Response.json({ message })
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await prisma.waMessage.update({
        where: { id: draft.id },
        data: { status: 'failed' },
      }).catch(() => {})

      console.error('=== ERRO NO ENVIO OUTBOUND (Meta/WhatsApp): ===')
      console.error(error)
      return Response.json(
        { error: 'Erro ao enviar a mensagem', details: errorMessage },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return Response.json(
      { error: 'Erro ao enviar a mensagem', details: errorMessage },
      { status: 500 }
    )
  }
}
