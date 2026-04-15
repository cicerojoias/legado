import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { SERVICE_POLICY_JSON_BLOCK } from '@/lib/whatsapp/service-policy'
import { createClient } from '@/lib/supabase/server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const SYSTEM_PROMPT = `Voce e o assistente de IA integrado do WhatsApp da joalheria Legado - Cicero Joias, uma marca de joias de luxo com tradicao familiar. Seu papel e gerar mensagens profissionais, elegantes e calorosas baseadas no prompt do atendente e no contexto da conversa.

Diretrizes:
- Tom: sofisticado mas acessivel, pessoal e humano - nunca robotico
- Linguagem: portugues brasileiro natural, sem gergias excessivas
- Tamanho: conciso e direto, ideal para WhatsApp (max. 3 paragrafos)
- Use emojis com moderacao (1-2 no maximo), apenas quando apropriado
- Se faltar contexto ou a pergunta for sobre um servico nao confirmado, nao invente resposta negativa. Prefira dizer que precisa confirmar com um especialista
- Assine sempre como equipe da Legado - Cicero Joias quando relevante
- NAO inclua explicacoes ou comentarios - apenas a mensagem final pronta para envio

## POLITICA OFICIAL DE SERVICOS
Use como fonte de verdade:
${SERVICE_POLICY_JSON_BLOCK}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { prompt, conversationContext } = await req.json()

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 2) {
      return NextResponse.json(
        { error: 'Prompt invalido' },
        { status: 400 }
      )
    }

    // Construir o prompt com contexto da conversa
    let fullPrompt = prompt
    
    if (conversationContext && typeof conversationContext === 'string') {
      fullPrompt = `Contexto das ultimas mensagens:\n${conversationContext}\n\nInstrucao do atendente:\n${prompt}`
    } else {
      fullPrompt = `Instrucao do atendente:\n${prompt}`
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: fullPrompt },
      ],
      max_tokens: 400,
      temperature: 0.7,
    })

    const generated = completion.choices[0]?.message?.content?.trim() ?? ''
    
    if (!generated) {
      return NextResponse.json(
        { error: 'IA nao gerou resposta' },
        { status: 500 }
      )
    }

    return NextResponse.json({ generated })
  } catch (err) {
    console.error('[generate-chat]', err)
    return NextResponse.json(
      { error: 'Falha ao gerar mensagem com IA' },
      { status: 500 }
    )
  }
}
