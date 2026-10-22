import { NextRequest, NextResponse } from 'next/server'
import { dispatchPushResumoDiario } from '@/lib/whatsapp/push-dispatcher'

/**
 * API Route protegida para receber o cron job diário de resumo financeiro.
 * 
 * Chamada pelo Vercel Cron (ou outro scheduler) no horário configurado.
 * Verifica e envia os resumos financeiros pendentes conforme horário de cada usuário.
 * 
 * Segurança: requer header Authorization com token secreto (CRON_SECRET).
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cron/daily-summary] Tentativa não autorizada de acesso')
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    console.log('[cron/daily-summary] Iniciando verificação do resumo diário')
    const result = await dispatchPushResumoDiario()

    return NextResponse.json({
      success: true,
      message: 'Verificação do resumo diário concluída',
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/daily-summary] Erro ao enviar resumo diário:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao enviar resumo diário',
      },
      { status: 500 }
    )
  }
}

/**
 * Permite teste manual via GET (apenas em desenvolvimento)
 */
export async function GET(req: NextRequest) {
  const isDev = process.env.NODE_ENV === 'development'
  
  if (!isDev) {
    return NextResponse.json(
      { error: 'Método não permitido em produção' },
      { status: 405 }
    )
  }

  // Em desenvolvimento, chama o POST diretamente
  return POST(req)
}
