import { prisma } from '@/lib/prisma'
import { sendTemplateMessage } from '@/lib/whatsapp/meta-client'
import { createClient } from '@/lib/supabase/server'
import { WA_TEMPLATES } from '@/lib/whatsapp/templates'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  try {
    const body = (await req.json()) as {
      conversationId: string
      templateName: string
      params: string[]
    }
    const { conversationId, templateName, params } = body

    if (!conversationId || !templateName) {
      return Response.json(
        { error: 'conversationId e templateName são obrigatórios' },
        { status: 400 }
      )
    }

    const templateConfig = WA_TEMPLATES.find((t) => t.name === templateName)
    if (!templateConfig) {
      return Response.json({ error: 'Template não encontrado' }, { status: 404 })
    }

    const conversation = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    })

    if (!conversation) {
      return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    const waMessageId = await sendTemplateMessage(
      conversation.contact.phone,
      templateName,
      templateConfig.language,
      params ?? []
    )

    // Montar preview do conteúdo substituindo variáveis para armazenar no banco
    let content = templateConfig.preview
    ;(params ?? []).forEach((p, i) => {
      content = content.replace(`{{${i + 1}}}`, p)
    })

    const message = await prisma.waMessage.create({
      data: {
        conversation_id: conversationId,
        wa_message_id: waMessageId || undefined,
        direction: 'outbound',
        type: 'text',
        content,
        status: 'sent',
        sent_by: user.id,
        timestamp: new Date(),
      },
    })

    await prisma.waConversation.update({
      where: { id: conversationId },
      data: { last_message_at: new Date() },
    })

    return Response.json({ message })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('=== ERRO NO ENVIO DE TEMPLATE (Meta/WhatsApp): ===')
    console.error(err)
    return Response.json(
      { error: 'Erro ao enviar template', details: err.message },
      { status: 500 }
    )
  }
}
