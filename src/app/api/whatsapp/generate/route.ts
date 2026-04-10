import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { SERVICE_POLICY_JSON_BLOCK } from '@/lib/whatsapp/service-policy'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

const SYSTEM_PROMPT = `Voce e um assistente especializado da joalheria Legado - Cicero Joias, uma marca de joias de luxo com tradicao familiar. Seu papel e transformar mensagens informais ou rascunhos em respostas profissionais, elegantes e calorosas para envio via WhatsApp.

Diretrizes:
- Tom: sofisticado mas acessivel, pessoal e humano - nunca robotico
- Linguagem: portugues brasileiro natural, sem gergias excessivas
- Tamanho: conciso e direto, ideal para WhatsApp (max. 3 paragrafos)
- Mantenha emojis com moderacao (1-2 no maximo), apenas se ja houver no rascunho
- Preserve o conteudo essencial da mensagem original
- Se faltar contexto ou a pergunta for sobre um servico nao confirmado, nao invente resposta negativa. Prefira dizer que precisa confirmar com um especialista
- Assine sempre como equipe da Legado - Cicero Joias quando relevante

## POLITICA OFICIAL DE SERVICOS
Use como fonte de verdade:
${SERVICE_POLICY_JSON_BLOCK}`

export async function POST(req: NextRequest) {
  const { draft, context } = await req.json()

  if (!draft || typeof draft !== 'string' || draft.trim().length < 2) {
    return NextResponse.json({ error: 'Rascunho invalido' }, { status: 400 })
  }

  const prompt = context
    ? `Contexto da conversa:\n${context}\n\nRascunho da resposta:\n${draft}`
    : `Rascunho da resposta:\n${draft}`

  try {
    const result = await genai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: SYSTEM_PROMPT + '\n\n' + prompt,
    })
    const generated = result.text ?? ''
    return NextResponse.json({ generated })
  } catch (err) {
    console.error('[generate]', err)
    return NextResponse.json({ error: 'Falha ao gerar resposta' }, { status: 500 })
  }
}
