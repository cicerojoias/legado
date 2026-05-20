import { prisma } from '@/lib/prisma'
import { sendPush } from './push-client'

/**
 * Busca todas as subscriptions de usuários ADMIN/SUPER_ADMIN/GERENTE ativos,
 * respeita as preferências individuais (notif_push),
 * monta o payload com unreadCount e dispara push em paralelo.
 *
 * Chamado via after() no webhook — roda após a resposta 200 ser enviada à Meta.
 * Falhas individuais de entrega não propagam (Promise.allSettled).
 */
export async function dispatchPushForConversation(
  conversationId: string,
  contactName: string,
  messageContent: string
): Promise<void> {
  try {
    console.log(`[push-dispatcher] Iniciando envio para conversa ${conversationId}`)
    
    const subscriptions = await prisma.waPushSubscription.findMany({
      where: {
        user: {
          role: { in: ['ADMIN', 'SUPER_ADMIN', 'GERENTE'] },
          ativo: true,
          // notif_push gate applies only to daily summary — WAB alerts go to all subscribed eligible users
        },
      },
      select: { 
        endpoint: true, 
        p256dh: true, 
        auth: true,
        user: { select: { id: true, nome: true, role: true } }
      },
    })

    console.log(`[push-dispatcher] Encontradas ${subscriptions.length} subscriptions elegíveis`)

    if (subscriptions.length === 0) {
      console.log('[push-dispatcher] Nenhuma subscription encontrada. Verifique: 1) Usuários com role ADMIN/SUPER_ADMIN/GERENTE, 2) ativo=true, 3) subscriptions registradas no perfil')
      return
    }

    // Conta conversas abertas para atualizar o badge do app
    const unreadCount = await prisma.waConversation.count({
      where: { status: 'open' },
    })

    const payload = {
      title: contactName,
      body: messageContent.slice(0, 120),
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      conversationId,
      url: `/inbox/${conversationId}`,
      unreadCount,
    }

    console.log(`[push-dispatcher] Enviando push para ${subscriptions.length} dispositivo(s)`)
    console.log(`[push-dispatcher] Payload:`, JSON.stringify({ title: payload.title, body: payload.body, conversationId: payload.conversationId }))

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPush(sub.endpoint, sub.p256dh, sub.auth, payload))
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected')
    
    console.log(`[push-dispatcher] Resultado: ${succeeded} sucesso(s), ${failed.length} falha(s)`)
    
    if (failed.length > 0) {
      console.error(`[push-dispatcher] ${failed.length}/${subscriptions.length} pushes falharam`, failed)
    }
  } catch (error) {
    console.error('[push-dispatcher] Erro ao enviar notificação push:', error)
  }
}

/**
 * Calcula os totais financeiros do dia atual (entradas, saídas, saldo, métodos de pagamento)
 * e retorna um objeto formatado para uso em notificações push.
 */
async function getTotaisFinanceirosDoDia(): Promise<{
  entradas: number
  saidas: number
  pix: number
  debito: number
  credito: number
  especie: number
  saldo: number
  numLancamentos: number
}> {
  // Obter data atual no fuso horário do Brasil (UTC-3) para garantir o cálculo correto do dia
  const tzOffset = -3 * 60 * 60 * 1000
  const localNow = new Date(Date.now() + tzOffset)
  const todayStart = new Date(Date.UTC(localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate()))
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

  const lancamentos = await prisma.lancamento.findMany({
    where: {
      data_ref: {
        gte: todayStart,
        lte: todayEnd,
      },
      deletado_at: null, // Apenas lançamentos ativos
    },
    select: {
      tipo: true,
      valor: true,
      metodo_pgto: true,
    },
  })

  let entradas = 0
  let saidas = 0
  let pix = 0
  let debito = 0
  let credito = 0
  let especie = 0

  for (const l of lancamentos) {
    const valor = Number(l.valor) || 0

    if (l.tipo === 'ENTRADA') {
      entradas += valor
      const metodo = l.metodo_pgto?.toUpperCase()
      if (metodo === 'PIX') pix += valor
      else if (metodo === 'C_DEBITO' || metodo === 'DEBITO') debito += valor
      else if (metodo === 'C_CREDITO' || metodo === 'CREDITO') credito += valor
      else if (metodo === 'ESPECIE') especie += valor
    } else {
      saidas += valor
    }
  }

  return {
    entradas,
    saidas,
    pix,
    debito,
    credito,
    especie,
    saldo: entradas - saidas,
    numLancamentos: lancamentos.length,
  }
}

/**
 * Formata valor em BRL para exibição em notificações
 */
function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/**
 * Envia notificações push de resumo financeiro diário para ADMIN e SUPER_ADMIN.
 * Respeita as preferências individuais (notif_push, notif_horario).
 * GERENTE e OPERADOR NÃO recebem este resumo.
 */
export async function dispatchPushResumoDiario(): Promise<void> {
  try {
    console.log('[push-dispatcher] Iniciando envio de resumo diário')

    const totais = await getTotaisFinanceirosDoDia()

    const body = [
      `Entradas: ${formatBRL(totais.entradas)}`,
      `Saídas: ${formatBRL(totais.saidas)}`,
      `Saldo: ${formatBRL(totais.saldo)}`,
      totais.numLancamentos > 0 && `${totais.numLancamentos} lançamento(s) registrado(s)`,
    ]
      .filter(Boolean)
      .join('\n')

    const payload = {
      title: '📊 Resumo Financeiro do Dia',
      body,
      icon: '/icon-192.png',
      badge: '/badge-96.png',
      type: 'daily-summary',
      url: '/hoje',
      unreadCount: 0,
      data: {
        entradas: totais.entradas,
        saidas: totais.saidas,
        saldo: totais.saldo,
        pix: totais.pix,
        debito: totais.debito,
        credito: totais.credito,
        especie: totais.especie,
      },
    }

    const subscriptions = await prisma.waPushSubscription.findMany({
      where: {
        user: {
          role: { in: ['ADMIN', 'SUPER_ADMIN'] },
          ativo: true,
          notif_push: true,
        },
      },
      select: { endpoint: true, p256dh: true, auth: true, user: { select: { nome: true, notif_horario: true } } },
    })

    if (subscriptions.length === 0) {
      console.log('[push-dispatcher] Nenhuma subscription elegível para resumo diário. Verifique: 1) Usuários com role ADMIN/SUPER_ADMIN, 2) ativo=true, 3) notif_push=true, 4) subscriptions registradas')
      return
    }

    console.log(`[push-dispatcher] Enviando resumo diário para ${subscriptions.length} usuário(s)`)
    console.log(`[push-dispatcher] Payload:`, JSON.stringify({ title: payload.title, body: payload.body }))

    const results = await Promise.allSettled(
      subscriptions.map((sub) => sendPush(sub.endpoint, sub.p256dh, sub.auth, payload))
    )

    const succeeded = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected')
    
    console.log(`[push-dispatcher] Resumo diário: ${succeeded} sucesso(s), ${failed.length} falha(s)`)
    
    if (failed.length > 0) {
      console.error(`[push-dispatcher] ${failed.length}/${subscriptions.length} pushes de resumo diário falharam`, failed)
    } else {
      console.log(`[push-dispatcher] Resumo diário enviado com sucesso para ${subscriptions.length} usuário(s)`)
    }
  } catch (error) {
    console.error('[push-dispatcher] Erro ao enviar resumo diário:', error)
  }
}
