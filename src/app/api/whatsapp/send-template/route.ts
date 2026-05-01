import { prisma } from '@/lib/prisma'
import { sendTemplateMessage, validateTemplate } from '@/lib/whatsapp/meta-client'
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
        { error: 'conversationId e templateName são obrigatórios' },
        { status: 400 }
      )
    }

    const templateConfig = WA_TEMPLATES.find((t) => t.name === templateName)
    if (!templateConfig) {
      return Response.json({ error: 'Template não encontrado na configuração local' }, { status: 404 })
    }

    // Validação prévia do template na Meta (opcional, mas recomendado)
    const isTemplateValid = await validateTemplate(templateName, templateConfig.language)
    if (!isTemplateValid) {
      console.error(
        `[send-template] Template "${templateName}" não está aprovado na Meta. ` +
          'Verifique no Meta Business Manager se o template foi aprovado.'
      )
      return Response.json(
        {
          error: `Template "${templateName}" não está disponível ou não foi aprovado pela Meta.`,
          details: 'Verifique no Meta Business Manager > WhatsApp > Gerenciador de Modelos se o template está com status "Aprovado".',
        },
        { status: 400 }
      )
    }

    const conversation = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    })

    if (!conversation) {
      return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
    }

    if (!conversation.contact.phone) {
      return Response.json({ error: 'Contato sem número de telefone' }, { status: 400 })
    }

    const now = new Date()

    // Montar preview do conteúdo substituindo variáveis para armazenar no banco
    let content = templateConfig.preview
    ;(params ?? []).forEach((p, i) => {
      content = content.replace(`{{${i + 1}}}`, p)
    })

    console.log(`[send-template] Enviando template "${templateName}" para ${conversation.contact.phone}`)
    console.log(`[send-template] Parâmetros:`, params)

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

    if (!waMessageId) {
      throw new Error('Meta não retornou o ID da mensagem')
    }

    const message = await prisma.waMessage.update({
      where: { id: draft.id },
      data: {
        wa_message_id: waMessageId,
        status: 'sent',
      },
    })

    console.log(`[send-template] Template enviado com sucesso. wa_message_id: ${waMessageId}`)
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
