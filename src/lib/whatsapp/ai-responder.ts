import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { sendTextMessage } from './meta-client'

// ─── Prompt do sistema — edite aqui para ajustar o comportamento da IA ──────
const SYSTEM_PROMPT = `Você é um assistente de atendimento ao cliente de uma joalheria/ótica.
Responda de forma educada, clara e concisa em português brasileiro.
Seja cordial e prestativo. Mantenha respostas curtas e diretas — é uma conversa por WhatsApp.
Quando não souber responder algo específico (preços exatos, disponibilidade de estoque, prazos), diga:
"Vou verificar e um de nossos atendentes entrará em contato em breve."
Nunca invente informações sobre produtos, preços ou prazos.`

export async function maybeRespondWithAI(
  conversationId: string,
  waId: string,
): Promise<void> {
  // 1. Verificar se IA está ativa para esta conversa
  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    select: { ia_ativa: true },
  })
  if (!conversation?.ia_ativa) return

  // 2. Buscar últimas 20 mensagens de texto para contexto
  const history = await prisma.waMessage.findMany({
    where: { conversation_id: conversationId, type: 'text' },
    orderBy: { timestamp: 'desc' },
    take: 20,
    select: { direction: true, content: true },
  })

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = history
    .reverse()
    .filter((m) => m.content)
    .map((m) => ({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content!,
    }))

  if (messages.length === 0) return

  // 3. Chamar GPT-4o Mini
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 400,
    temperature: 0.7,
  })

  const aiReply = completion.choices[0]?.message?.content?.trim()
  if (!aiReply) return

  // 4. Enviar via WhatsApp
  const waMessageId = await sendTextMessage(waId, aiReply)

  // 5. Persistir no banco
  await prisma.waMessage.create({
    data: {
      wa_message_id: waMessageId || undefined,
      conversation_id: conversationId,
      direction: 'outbound',
      type: 'text',
      content: aiReply,
      status: 'sent',
      timestamp: new Date(),
      sent_by: 'ai',
    },
  })

  console.log(`[ai-responder] Resposta enviada para ${waId}`)
}
