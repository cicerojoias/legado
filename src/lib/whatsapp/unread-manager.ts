import { prisma } from '@/lib/prisma'

/**
 * Incrementa unreadCount em WaConversationRead para todos os usuários
 * ADMIN, SUPER_ADMIN e GERENTE ativos quando uma mensagem inbound chega.
 * Chamado sincronamente no webhook durante o fluxo principal de recebimento.
 */
export async function incrementUnreadForConversation(conversationId: string) {
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'GERENTE'] }, ativo: true },
    select: { id: true },
  })

  await Promise.all(
    adminUsers.map((u) =>
      prisma.waConversationRead.upsert({
        where: { userId_conversationId: { userId: u.id, conversationId } },
        update: { unreadCount: { increment: 1 } },
        create: { userId: u.id, conversationId, unreadCount: 1 },
      })
    )
  )
}
