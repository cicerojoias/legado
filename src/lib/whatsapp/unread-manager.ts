import { prisma } from '@/lib/prisma'

/**
 * Incrementa unreadCount em WaConversationRead para todos os usuários
 * ADMIN e SUPER_ADMIN ativos quando uma mensagem inbound chega.
 * Chamado via after() no webhook — não bloqueia a resposta à Meta.
 */
export async function incrementUnreadForConversation(conversationId: string) {
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, ativo: true },
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
