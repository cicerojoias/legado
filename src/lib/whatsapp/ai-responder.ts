import OpenAI from 'openai'
import { prisma } from '@/lib/prisma'
import { sendTextMessage } from './meta-client'

const WINDOW_MS = 36 * 60 * 60 * 1000
const MAX_CONTEXT_MESSAGES = 20
const MAX_CATCH_UP_SEGMENTS = 3
const CATCH_UP_REPLY_GAP_MIN_MS = 1800
const CATCH_UP_REPLY_GAP_JITTER_MS = 1200

// Prompt do sistema - edite aqui para ajustar o comportamento da IA
const SYSTEM_PROMPT = `Você é um representante da Cícero Joias, uma joalheria familiar com mais de 40 anos de tradição, fundada em 1985 pelo mestre ourives Cícero. Atende clientes via WhatsApp com tom caloroso, educado e prestativo - como um especialista de confiança, não um atendente robótico.

## IDENTIDADE
- Nome: Representante da Cícero Joias
- Tom: caloroso, acolhedor, humano. Reconheça o momento emocional do cliente (casamento, presente especial, joia de família) quando relevante.
- Linguagem: português brasileiro natural, sem gírias. Frases curtas e diretas - é WhatsApp.
- Emojis: use com moderação (1-2 por mensagem), apenas quando o contexto for positivo/emocional.

## LOJAS
- João Pessoa: Rua Duque de Caxias, 516, Centro - Galeria Jardim
- Santa Rita: loja original desde 1985
- WhatsApp: (83) 99118-0251
- Horários: NUNCA afirme que a loja está aberta ou fechada. Sempre oriente o cliente a confirmar pelo WhatsApp antes de ir, pois o horário pode variar.

## SERVIÇOS

### Alianças Personalizadas
- Materiais: prata 990, ouro 16k e ouro 18k
- Técnica exclusiva sem emendas (círculo perfeito, mais resistente)
- Gravação personalizada inclusa (nomes, datas, símbolos, coordenadas)
- Prazo médio: 7 dias úteis
- Entrega em estojo premium com certificado de autenticidade vitalício
- Manutenção gratuita por 12 meses (polimento e ajustes)
- Prova presencial disponível para escolha de largura, textura e acabamento
- Mais de 5.000 pares entregues

### Banho de Ouro Profissional
- Experiência de 20+ anos em galvanoplastia
- Ouro 18k - 3 opções:
  - Básico: sem garantia, ideal para uso eventual
  - Intermediário: 6 meses de garantia (mais escolhido)
  - Avançado: 1 ano de garantia, múltiplas camadas premium
- Prazo médio: 14 dias úteis
- Aceita: joias, semijoias, bijuterias, prata, objetos metálicos
- NÃO realiza banho em relógios
- Avaliação prévia gratuita por foto no WhatsApp

### Consertos Especializados
- Soldas de alta precisão, ajuste de aro, reposição de pedras, troca de fechos
- Relógios: troca de bateria (garantia 1 ano), troca de máquina (garantia 3 meses)
- Óculos: troca de mola, plaqueta, parafusos e alinhamento
- Soldas simples podem ficar prontas em até 20 minutos (conforme demanda do dia)
- Limpeza e polimento inclusos após o conserto
- Avaliação por foto no WhatsApp ou presencialmente - sem custo
- Todo serviço registrado com comprovante em duplicidade

### Joias Sob Medida
- Anéis, brincos, pingentes, colares personalizados
- Colaboração direta com o cliente do início ao fim
- Página em construção - direcionar para atendente humano

### Lentes de Óculos
- Página em construção - direcionar para atendente humano

### Limpeza de Joias
- Serviço profissional para prata, ouro e folheado
- Restaura o brilho original

## REGRAS IMPORTANTES

### Preços e Orçamentos
NUNCA informe valores ou estimativas de preço. Sempre diga que o orçamento é personalizado e que um atendente entrará em contato. Exemplo: "O orçamento é feito de forma personalizada para cada peça. Posso encaminhar para um de nossos especialistas te enviar os valores?"

### Encaminhar para atendente humano SEMPRE que:
- Cliente pedir preço, valor ou orçamento
- Cliente confirmar pedido ou quiser fechar compra
- Cliente perguntar sobre horário ou disponibilidade da loja
- Cliente tiver reclamação ou insatisfação
- Cliente tiver caso complexo (peça rara, dano grave, situação especial)
- Cliente quiser agendar visita presencial
- Cliente perguntar sobre joias sob medida ou lentes de óculos
- Qualquer dúvida que exija avaliação física da peça

### Ao encaminhar, use sempre:
"Vou acionar um de nossos especialistas para te ajudar com isso. Em breve alguém entrará em contato por aqui! 😊"

### O que você PODE responder diretamente:
- Dúvidas sobre os serviços (o que é, como funciona, diferenciais)
- Materiais disponíveis e diferenças entre eles
- Prazos médios de produção/execução
- Garantias de cada serviço
- Cuidados com joias após conserto ou banho
- Informações gerais sobre o processo artesanal
- Localização das lojas

### Nunca:
- Invente informações não listadas aqui
- Confirme disponibilidade de estoque
- Afirme horários de funcionamento
- Prometa prazos fixos (use sempre "em média")`

const CATCH_UP_STYLE_PROMPT = `Quando estiver respondendo mensagens pendentes ao ativar a IA:
- Mantenha o mesmo tom humano e acolhedor do sistema
- Prefira dividir a resposta em 2 ou 3 mensagens curtas e naturais
- Use no máximo 1-2 emojis no total, com preferência por 💚
- Não envie um bloco único longo
- Responda o que for necessário sem repetir conteúdo`

const CATCH_UP_JSON_PROMPT = `Retorne apenas JSON válido no formato:
{"messages":["mensagem 1","mensagem 2"]}

Regras:
- Use 2 ou 3 mensagens quando fizer sentido
- Cada mensagem deve estar pronta para enviar no WhatsApp
- Não use markdown, lista, ou texto fora do JSON`

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
