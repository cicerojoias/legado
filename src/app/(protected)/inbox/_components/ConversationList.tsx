import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { createServerTiming } from '@/lib/server-timing'
import { InboxConversationList } from './InboxConversationList'
import type { ConversationWithPreview } from './types'

/**
 * Carrega a lista padrão (top 50, sem filtros) no servidor, em streaming dentro do layout.
 * Filtros são resolvidos client-side em InboxConversationList.
 */
export async function ConversationList({ userId }: { userId: string }) {
  const timing = createServerTiming('inbox/conversation-list')
  const rawConversations = await timing.measure('list', prisma.waConversation.findMany({
    orderBy: { last_message_at: 'desc' },
    include: {
      contact: true,
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
      conversation_reads: {
        where: { userId },
        take: 1,
      },
      conversation_tags: {
        include: { tag: true },
        orderBy: { assignedAt: 'asc' },
      },
    },
    take: 50,
  }))
  timing.log()

  const conversations: ConversationWithPreview[] = rawConversations.map((conv) => ({
    ...conv,
    unreadCount: conv.conversation_reads[0]?.unreadCount ?? 0,
  }))

  return (
    <Suspense fallback={null}>
      <InboxConversationList initialConversations={conversations} userId={userId} />
    </Suspense>
  )
}
