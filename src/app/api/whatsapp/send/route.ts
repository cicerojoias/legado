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

    // Enviar via Meta Cloud API
    const waMessageId = await sendTextMessage(conversation.contact.phone, text.trim())

    // Persistir mensagem enviada
    const message = await prisma.waMessage.create({
      data: {
        conversation_id: conversationId,
        wa_message_id: waMessageId || undefined,
        direction: 'outbound',
        type: 'text',
        content: text.trim(),
        status: 'sent',
        sent_by: user.id,
        timestamp: new Date(),
        replyToId: replyToId ?? null,
        replyToSnapshot: replyToSnapshot ? replyToSnapshot.slice(0, 500) : null,
      },
    })

    // Atualizar last_message_at da conversa
    await prisma.waConversation.update({
      where: { id: conversationId },
      data: { last_message_at: new Date() },
    })

    return Response.json({ message })
  } catch (error: any) {
    console.error('=== ERRO NO ENVIO OUTBOUND (Meta/WhatsApp): ===')
    console.error(error)
    return Response.json(
      { error: 'Erro ao enviar a mensagem', details: error.message || error },
      { status: 500 }
    )
  }
}
