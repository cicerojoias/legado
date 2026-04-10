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

  let draftId: string | null = null
  try {
    const body = (await req.json()) as {
      conversationId: string
      templateName: string
      params: string[]
    }
    const { conversationId, templateName, params } = body

    if (!conversationId || !templateName) {
      return Response.json(
        { error: 'conversationId e templateName sÃ£o obrigatÃ³rios' },
        { status: 400 }
      )
    }

    const templateConfig = WA_TEMPLATES.find((t) => t.name === templateName)
    if (!templateConfig) {
      return Response.json({ error: 'Template nÃ£o encontrado' }, { status: 404 })
    }

    const conversation = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    })

    if (!conversation) {
      return Response.json({ error: 'Conversa nÃ£o encontrada' }, { status: 404 })
    }

    const now = new Date()

    // Montar preview do conteúdo substituindo variáveis para armazenar no banco
    let content = templateConfig.preview
    ;(params ?? []).forEach((p, i) => {
      content = content.replace(`{{${i + 1}}}`, p)
    })

    const draft = await prisma.waMessage.create({
      data: {
        conversation_id: conversationId,
        direction: 'outbound',
        type: 'text',
        content,
        status: 'pending',
        sent_by: user.id,
        timestamp: now,
      },
    })
    draftId = draft.id

    await prisma.waConversation.update({
      where: { id: conversationId },
      data: { last_message_at: now },
    })

    const waMessageId = await sendTemplateMessage(
      conversation.contact.phone,
      templateName,
      templateConfig.language,
      params ?? []
    )

    const message = await prisma.waMessage.update({
      where: { id: draft.id },
      data: {
        wa_message_id: waMessageId || undefined,
        status: 'sent',
      },
    })
    return Response.json({ message })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    if (draftId) {
      await prisma.waMessage.update({
        where: { id: draftId },
        data: { status: 'failed' },
      }).catch(() => {})
    }
    console.error('=== ERRO NO ENVIO DE TEMPLATE (Meta/WhatsApp): ===')
    console.error(err)
    return Response.json(
      { error: 'Erro ao enviar template', details: err.message },
      { status: 500 }
    )
  }
}
