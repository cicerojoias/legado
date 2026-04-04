import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { ConversationItem } from './ConversationItem'
import type { ConversationWithPreview } from './types'

interface ConversationListProps {
  activeId?: string
  filterUnread?: boolean
}

export async function ConversationList({ activeId, filterUnread }: ConversationListProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const rawConversations = await prisma.waConversation.findMany({
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
    },
    take: 50,
  })

  const conversations: ConversationWithPreview[] = rawConversations
    .map((conv) => ({
      ...conv,
      unreadCount: conv.conversation_reads[0]?.unreadCount ?? 0,
    }))
    .filter((conv) => !filterUnread || conv.unreadCount > 0)

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm px-8 text-center gap-2 py-16">
        <p className="text-2xl">{filterUnread ? '✅' : '💬'}</p>
        <p className="font-medium">
          {filterUnread ? 'Nenhuma mensagem não lida' : 'Nenhuma conversa ainda'}
        </p>
        <p className="text-xs">
          {filterUnread
            ? 'Você está em dia com todas as conversas.'
            : 'As mensagens recebidas no WhatsApp aparecerão aqui.'}
        </p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/50">
      {conversations.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === activeId}
        />
      ))}
    </div>
  )
}
