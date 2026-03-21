import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })


const SYSTEM_PROMPT = `Você é um assistente especializado da joalheria Legado — Cícero Joias, uma marca de joias de luxo com tradição familiar. Seu papel é transformar mensagens informais ou rascunhos em respostas profissionais, elegantes e calorosas para envio via WhatsApp.

Diretrizes:
- Tom: sofisticado mas acessível, pessoal e humano — nunca robótico
- Linguagem: português brasileiro natural, sem gírias excessivas
- Tamanho: conciso e direto, ideal para WhatsApp (máx. 3 parágrafos)
- Mantenha emojis com moderação (1-2 no máximo), apenas se já houver no rascunho
- Preserve o conteúdo essencial da mensagem original
- Assine sempre como equipe da Legado — Cícero Joias quando relevante`

export async function POST(req: NextRequest) {
  const { draft, context } = await req.json()

  if (!draft || typeof draft !== 'string' || draft.trim().length < 2) {
    return NextResponse.json({ error: 'Rascunho inválido' }, { status: 400 })
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
