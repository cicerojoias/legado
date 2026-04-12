import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { SERVICE_POLICY_JSON_BLOCK } from '@/lib/whatsapp/service-policy'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

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

    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: SYSTEM_PROMPT + '\n\n' + fullPrompt,
    })

    const generated = result.text?.trim() ?? ''
    
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
