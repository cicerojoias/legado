import { NextRequest, NextResponse } from 'next/server'
import { dispatchPushResumoDiario } from '@/lib/whatsapp/push-dispatcher'

/**
 * API Route protegida para receber o cron job diário de resumo financeiro.
 * 
 * Chamada pelo Vercel Cron (ou outro scheduler) no horário configurado.
 * Envia notificações push de resumo financeiro para ADMIN e SUPER_ADMIN.
 * 
 * Segurança: requer header Authorization com token secreto (CRON_SECRET).
 */
export async function POST(req: NextRequest) {
  // Proteção: verifica token secreto do cron job
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    console.warn('[cron/daily-summary] Tentativa não autorizada de acesso')
    return NextResponse.json(
      { error: 'Não autorizado' },
      { status: 401 }
    )
  }

  try {
    console.log('[cron/daily-summary] Iniciando envio de resumo diário')
    
    await dispatchPushResumoDiario()
    
    return NextResponse.json({
      success: true,
      message: 'Resumo diário enviado com sucesso',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cron/daily-summary] Erro ao enviar resumo diário:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno ao enviar resumo diário',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
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
