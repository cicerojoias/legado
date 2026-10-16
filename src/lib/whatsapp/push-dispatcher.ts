import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { sendPush } from './push-client'

/**
 * Envia alertas para os dispositivos inscritos de todos os usuários ativos,
 * não exige a preferência notif_push, que controla apenas o resumo diário.
 * Monta o payload com unreadCount e dispara push em paralelo.
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
          ativo: true,
          role: { in: ['GERENTE', 'ADMIN', 'SUPER_ADMIN'] },
          // notif_push gate applies only to daily summary
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
      console.log('[push-dispatcher] Nenhuma subscription encontrada. Verifique se os usuários estão ativos e inscreveram seus dispositivos no perfil')
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
      badge: '/notification-badge-v2.png',
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
 * Envia resumo financeiro aos dispositivos ativos com preferência habilitada e horário atingido.
 * Respeita as preferências individuais (notif_push, notif_horario).
 * Cada usuário ativo pode habilitar o resumo e escolher seu horário.
 */
export async function dispatchPushResumoDiario(): Promise<{ sentDevices: number; failedDevices: number }> {
  console.log('[push-dispatcher] Verificando resumos diários pendentes')

  const now = new Date()
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((item) => item.type === type)?.value ?? ''
  const year = Number(part('year'))
  const month = Number(part('month'))
  const day = Number(part('day'))
  const currentTime = `${part('hour')}:${part('minute')}`
  const todayStart = new Date(Date.UTC(year, month - 1, day, 3))
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const [subscriptions, sentLogs] = await Promise.all([
    prisma.waPushSubscription.findMany({
      where: { user: { ativo: true, notif_push: true, role: { in: ['ADMIN', 'SUPER_ADMIN'] } } },
      select: {
        endpoint: true,
        p256dh: true,
        auth: true,
        user: { select: { id: true, notif_horario: true } },
      },
    }),
    prisma.log.findMany({
      where: {
        acao: 'PUSH_RESUMO_DIARIO_ENVIADO',
        created_at: { gte: todayStart, lt: tomorrowStart },
      },
      select: { detalhe: true },
    }),
  ])

  const sentEndpoints = new Set(
    sentLogs
      .map((log) => log.detalhe)
      .filter((detail): detail is string => Boolean(detail))
  )
  const dueSubscriptions = subscriptions.filter((sub) => {
    const endpointHash = createHash('sha256').update(sub.endpoint).digest('hex')
    return sub.user.notif_horario <= currentTime && !sentEndpoints.has(endpointHash)
  })

  if (dueSubscriptions.length === 0) {
    console.log('[push-dispatcher] Nenhum resumo diário pendente neste horário')
    return { sentDevices: 0, failedDevices: 0 }
  }

  const totais = await getTotaisFinanceirosDoDia()
  const body = [
    `Entradas: ${formatBRL(totais.entradas)}`,
    `Saídas: ${formatBRL(totais.saidas)}`,
    `Saldo: ${formatBRL(totais.saldo)}`,
    totais.numLancamentos > 0 && `${totais.numLancamentos} lançamento(s) registrado(s)`,
  ].filter(Boolean).join('\n')

  const payload = {
    title: '📊 Resumo Financeiro do Dia',
    body,
    icon: '/icon-192.png',
    badge: '/notification-badge-v2.png',
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

  const results = await Promise.allSettled(
    dueSubscriptions.map((sub) => sendPush(sub.endpoint, sub.p256dh, sub.auth, payload))
  )
  let sentDevices = 0
  let failedDevices = 0

  await Promise.all(results.map(async (result, index) => {
    const subscription = dueSubscriptions[index]
    if (result.status === 'rejected') {
      failedDevices += 1
      console.error('[push-dispatcher] Falha em resumo diário para um dispositivo', result.reason)
      return
    }

    sentDevices += 1
    const endpointHash = createHash('sha256').update(subscription.endpoint).digest('hex')
    await prisma.log.create({
      data: {
        acao: 'PUSH_RESUMO_DIARIO_ENVIADO',
        detalhe: endpointHash,
        usuario_id: subscription.user.id,
      },
    })
  }))

  console.log(`[push-dispatcher] Resumo diário: ${sentDevices} dispositivo(s) aceito(s), ${failedDevices} falha(s)`)
  if (failedDevices > 0) {
    throw new Error(`Falha ao enviar resumo diário para ${failedDevices} dispositivo(s)`)
  }

  return { sentDevices, failedDevices }
}
