import { prisma } from '@/lib/prisma'
import { sendPush } from './push-client'

/**
 * Busca todas as subscriptions de usuários ADMIN/SUPER_ADMIN ativos,
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
  const subscriptions = await prisma.waPushSubscription.findMany({
    where: {
      user: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        ativo: true,
      },
    },
    select: { endpoint: true, p256dh: true, auth: true },
  })

  if (subscriptions.length === 0) return

  // Conta conversas abertas para atualizar o badge do app
  const unreadCount = await prisma.waConversation.count({
    where: { status: 'open' },
  })

  const payload = {
    title: contactName,
    body: messageContent.slice(0, 120),
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    conversationId,
    url: `/inbox/${conversationId}`,
    unreadCount,
  }

  const results = await Promise.allSettled(
    subscriptions.map((sub) => sendPush(sub.endpoint, sub.p256dh, sub.auth, payload))
  )

  const failed = results.filter((r) => r.status === 'rejected')
  if (failed.length > 0) {
    console.error(`[push-dispatcher] ${failed.length}/${subscriptions.length} pushes falharam`, failed)
  }
}
