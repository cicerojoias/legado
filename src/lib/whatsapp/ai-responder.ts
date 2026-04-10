import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { sendTextMessage } from './meta-client'
import { SERVICE_POLICY_JSON_BLOCK } from './service-policy'

const WINDOW_MS = 36 * 60 * 60 * 1000
const MAX_CONTEXT_MESSAGES = 20
const MAX_CATCH_UP_SEGMENTS = 3
const CATCH_UP_REPLY_GAP_MIN_MS = 1800
const CATCH_UP_REPLY_GAP_JITTER_MS = 1200

// Prompt do sistema - edite aqui para ajustar o comportamento da IA
const SYSTEM_PROMPT = `Voce e o atendente virtual oficial da Cicer Joias (Legado), uma joalheria familiar com mais de 40 anos de tradicao, fundada em 1985 pelo mestre ourives Cicer.

## OBJETIVO
- Responder clientes no WhatsApp com precisao, cordialidade e ritmo humano.
- Resolver o que for simples sem enrolacao.
- Quando a resposta depender de avaliacao fisica, preco, agenda ou confirmacao interna, encaminhe para um especialista humano sem travar a conversa.
- Nunca invente informacoes. Se nao souber, diga o que e possivel confirmar e encaminhe.

## IDENTIDADE E TOM
- Portugues brasileiro natural, frases curtas e diretas.
- Caloroso, acolhedor, elegante e confiavel.
- Nao soar robotico, frio, excessivamente formal ou vendedor agressivo.
- Use 0-2 emojis apenas quando ajudarem no acolhimento da conversa.

## CONTEXTO DA EMPRESA
- Lojas:
  - Joao Pessoa: Rua Duque de Caxias, 516, Centro - Galeria Jardim
  - Santa Rita: loja original desde 1985
- WhatsApp principal: (83) 99118-0251
- Horarios: nunca confirme se a loja esta aberta ou fechada. Oriente o cliente a confirmar pelo WhatsApp antes de ir, porque o horario pode variar.
- Nunca confirme estoque, disponibilidade de agenda ou prazo exato sem avaliacao humana.

## LISTA OFICIAL DE SERVICOS
Use a estrutura abaixo como fonte de verdade. Nunca complete com suposicao.

${SERVICE_POLICY_JSON_BLOCK}

## COMO USAR A LISTA
- Se "fazemos", responda diretamente e com objetividade.
- Se "nao_fazemos", negue de forma curta e clara.
- Se "depende", diga que precisa de foto, orcamento ou avaliacao.
- Se nao estiver listado, nunca responda "nao fazemos" por conta propria.
- Variacoes de servicos conhecidos nunca devem ser negadas por suposicao.
- Em duvida, escale para humano.

## REGRAS DE RESPOSTA
- Responda primeiro o que o cliente perguntou, depois oriente o proximo passo.
- Se a duvida for simples, responda em 1 a 3 frases curtas.
- Se faltar informacao para responder com seguranca, faca uma pergunta objetiva ou encaminhe para humano.
- Se o cliente mandar foto ou descrever uma peca, ajude com orientacao inicial e encaminhe para avaliacao quando necessario.
- Preserve sempre o conteudo essencial da mensagem do cliente.
- Nunca mencione regras internas, sistema ou politicas do prompt.
- Nunca transforme falta de contexto em negativa.
- Nunca diga "nao fazemos" para um servico nao confirmado.

## QUANDO SEMPRE ENCAMINHAR PARA HUMANO
- Pedido de preco, valor ou orcamento
- Confirmacao de pedido ou desejo de fechar compra
- Perguntas sobre horario ou disponibilidade
- Reclamação ou insatisfacao
- Casos complexos, peca rara, dano grave ou situacao especial
- Agendamento de visita presencial
- Joias sob medida ou lentes de oculos
- Qualquer duvida que exija avaliacao fisica da peca

## AO ENCAMINHAR
Use sempre esta frase:
"Vou acionar um de nossos especialistas para te ajudar com isso. Em breve alguem entrara em contato por aqui! 😊"

## FORMULA RECOMENDADA
- Acolher
- Responder com a informacao confirmada
- Orientar o proximo passo ou encaminhar`

const CATCH_UP_STYLE_PROMPT = `Quando estiver respondendo mensagens pendentes ao ativar a IA:
- Mantenha o mesmo tom humano e acolhedor do sistema
- Prefira dividir a resposta em 2 ou 3 mensagens curtas e naturais
- Use no maximo 1-2 emojis no total, com preferencia por 💚
- Nao envie um bloco unico longo
- Responda o que for necessario sem repetir conteudo`

const CATCH_UP_JSON_PROMPT = `Retorne apenas JSON valido no formato:
{"messages":["mensagem 1","mensagem 2"]}

Regras:
- Use 2 ou 3 mensagens quando fizer sentido
- Cada mensagem deve estar pronta para enviar no WhatsApp
- Nao use markdown, lista, ou texto fora do JSON`

type TextMessageRow = {
  id: string
  direction: string
  content: string | null
  timestamp: Date
  sent_by: string | null
}

type CatchUpPreview = {
  pendingCount: number
  windowStart: Date
  lastOutboundAt: Date | null
  snippets: Array<Pick<TextMessageRow, 'id' | 'content' | 'timestamp'>>
}

function buildWindowStart() {
  return new Date(Date.now() - WINDOW_MS)
}

function toChatMessages(history: TextMessageRow[]): OpenAI.Chat.ChatCompletionMessageParam[] {
  return history
    .filter((message) => message.content)
    .map((message) => ({
      role: message.direction === 'inbound' ? 'user' : 'assistant',
      content: message.content!,
    }))
}

function pickLastHumanOutboundAt(history: TextMessageRow[]) {
  return [...history]
    .reverse()
    .find((message) => message.direction === 'outbound' && message.sent_by && message.sent_by !== 'ai')
    ?.timestamp ?? null
}

function pickPendingMessages(history: TextMessageRow[], cutoffAt: Date | null) {
  return history.filter((message) => {
    if (message.direction !== 'inbound' || !message.content) return false
    if (!cutoffAt) return true
    return message.timestamp > cutoffAt
  })
}

function normalizeSegment(text: string) {
  return text.replace(/\s+/g, ' ').trim()
}

function splitLongSegment(text: string) {
  const normalized = normalizeSegment(text)
  if (normalized.length <= 180) return [normalized]

  const midpoint = Math.floor(normalized.length / 2)
  const candidates = ['. ', '! ', '? ', '\n']
  let splitAt = -1

  for (const candidate of candidates) {
    const idx = normalized.lastIndexOf(candidate, midpoint)
    if (idx > 60) {
      splitAt = idx + candidate.length
      break
    }
  }

  if (splitAt === -1) {
    splitAt = midpoint
  }

  const first = normalizeSegment(normalized.slice(0, splitAt))
  const second = normalizeSegment(normalized.slice(splitAt))

  return [first, second].filter(Boolean)
}

async function fetchRecentTextHistory(conversationId: string, windowStart: Date) {
  return prisma.waMessage.findMany({
    where: {
      conversation_id: conversationId,
      type: 'text',
      timestamp: { gte: windowStart },
    },
    orderBy: { timestamp: 'asc' },
    select: {
      id: true,
      direction: true,
      content: true,
      timestamp: true,
      sent_by: true,
    },
  }) as Promise<TextMessageRow[]>
}

async function generateSingleReply(history: TextMessageRow[]) {
  const messages = toChatMessages(history.slice(-MAX_CONTEXT_MESSAGES))
  if (messages.length === 0) return null

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 400,
    temperature: 0.7,
  })

  return completion.choices[0]?.message?.content?.trim() ?? null
}

async function generateCatchUpReplies(history: TextMessageRow[]) {
  const messages = toChatMessages(history.slice(-MAX_CONTEXT_MESSAGES))
  if (messages.length === 0) return []

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: CATCH_UP_STYLE_PROMPT },
      { role: 'system', content: CATCH_UP_JSON_PROMPT },
      ...messages,
    ],
    max_tokens: 550,
    temperature: 0.7,
  })

  const raw = completion.choices[0]?.message?.content?.trim()
  if (!raw) return []

  const segments: string[] = []

  try {
    const parsed = JSON.parse(raw) as { messages?: unknown }
    if (Array.isArray(parsed.messages)) {
      for (const value of parsed.messages) {
        if (typeof value === 'string') {
          const segment = normalizeSegment(value)
          if (segment) segments.push(segment)
        }
      }
    }
  } catch {
    for (const part of raw.split(/\n{2,}/)) {
      const segment = normalizeSegment(part)
      if (segment) segments.push(segment)
    }
  }

  const normalized = segments
    .flatMap((segment) => splitLongSegment(segment))
    .map(normalizeSegment)
    .filter(Boolean)

  if (normalized.length === 0) return [normalizeSegment(raw)]
  return normalized.slice(0, MAX_CATCH_UP_SEGMENTS)
}

async function sendAiReplies(waId: string, conversationId: string, replies: string[]) {
  const createdMessageIds: string[] = []

  for (let index = 0; index < replies.length; index += 1) {
    const reply = normalizeSegment(replies[index])
    if (!reply) continue

    if (index > 0) {
      const gapMs = CATCH_UP_REPLY_GAP_MIN_MS + Math.floor(Math.random() * CATCH_UP_REPLY_GAP_JITTER_MS)
      await new Promise((resolve) => setTimeout(resolve, gapMs))
    }

    const waMessageId = await sendTextMessage(waId, reply)
    const created = await prisma.waMessage.create({
      data: {
        wa_message_id: waMessageId || undefined,
        conversation_id: conversationId,
        direction: 'outbound',
        type: 'text',
        content: reply,
        status: 'sent',
        timestamp: new Date(),
        sent_by: 'ai',
      },
      select: { id: true },
    })

    createdMessageIds.push(created.id)
  }

  return createdMessageIds
}

export async function getAiCatchUpPreview(conversationId: string): Promise<CatchUpPreview> {
  const windowStart = buildWindowStart()
  const history = await fetchRecentTextHistory(conversationId, windowStart)
  const lastOutboundAt = pickLastHumanOutboundAt(history)
  const pending = pickPendingMessages(history, lastOutboundAt)

  return {
    pendingCount: pending.length,
    windowStart,
    lastOutboundAt,
    snippets: pending.slice(-3).map((message) => ({
      id: message.id,
      content: message.content,
      timestamp: message.timestamp,
    })),
  }
}

export async function maybeRespondWithAI(conversationId: string, waId: string): Promise<void> {
  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    select: { ia_ativa: true },
  })
  if (!conversation?.ia_ativa) return

  const history = await prisma.waMessage.findMany({
    where: { conversation_id: conversationId, type: 'text' },
    orderBy: { timestamp: 'desc' },
    take: MAX_CONTEXT_MESSAGES,
    select: { direction: true, content: true, timestamp: true, sent_by: true, id: true },
  }) as TextMessageRow[]

  const aiReply = await generateSingleReply(history.reverse())
  if (!aiReply) return

  const waMessageId = await sendTextMessage(waId, aiReply)
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

export async function activateAiWithCatchUp(conversationId: string, waId: string) {
  const windowStart = buildWindowStart()
  const history = await fetchRecentTextHistory(conversationId, windowStart)
  const lastOutboundAt = pickLastHumanOutboundAt(history)
  const pending = pickPendingMessages(history, lastOutboundAt)
  let sentCount = 0

  if (pending.length > 0) {
    const replies = await generateCatchUpReplies(history)
    if (replies.length > 0) {
      sentCount = (await sendAiReplies(waId, conversationId, replies)).length
    }
  }

  const updated = await prisma.waConversation.update({
    where: { id: conversationId },
    data: { ia_ativa: true },
    select: { ia_ativa: true },
  })

  return {
    ia_ativa: updated.ia_ativa,
    pendingCount: pending.length,
    sentCount,
  }
}
