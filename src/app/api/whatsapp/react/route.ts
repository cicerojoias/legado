import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { sendReaction } from '@/lib/whatsapp/meta-client'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as { messageId: string; emoji: string }
    const { messageId, emoji } = body

    if (!messageId || typeof emoji !== 'string') {
      return NextResponse.json({ error: 'messageId e emoji são obrigatórios' }, { status: 400 })
    }

    // Buscar mensagem + conversa + contato para obter o telefone do destinatário
    const message = await prisma.waMessage.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: { contact: true },
        },
      },
    })

    if (!message) {
      return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
    }

    if (!message.wa_message_id) {
      return NextResponse.json({ error: 'Mensagem sem ID Meta — não é possível reagir' }, { status: 400 })
    }

    const recipientPhone = message.conversation.contact.phone

    // Enviar reação para a Meta (emoji vazio = remover reação)
    await sendReaction(recipientPhone, message.wa_message_id, emoji)

    // Persistir no banco — null quando emoji vazio (remoção)
    await prisma.waMessage.update({
      where: { id: messageId },
      data: { reaction: emoji || null },
    })

    return NextResponse.json({ reaction: emoji || null })
  } catch (err) {
    console.error('[react] erro ao enviar reação:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
