import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { ConversationItem } from './ConversationItem'
import type { ConversationWithPreview } from './types'
import type { Prisma } from '@prisma/client'

interface ConversationListProps {
  activeId?:    string
  filterUnread?: boolean
  filterTagId?:  string
}

export async function ConversationList({ activeId, filterUnread, filterTagId }: ConversationListProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const where: Prisma.WaConversationWhereInput = {
    ...(filterUnread ? { conversation_reads: { some: { userId, unreadCount: { gt: 0 } } } } : {}),
    ...(filterTagId  ? { conversation_tags:  { some: { tagId: filterTagId } } } : {}),
  }

  // Sem take quando filtro ativo — evita perder conversas taggeadas fora do top-50
  const applyLimit = !filterTagId && !filterUnread

  const rawConversations = await prisma.waConversation.findMany({
    where,
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
    ...(applyLimit ? { take: 50 } : {}),
  })

  const conversations: ConversationWithPreview[] = rawConversations.map((conv) => ({
    ...conv,
    unreadCount: conv.conversation_reads[0]?.unreadCount ?? 0,
  }))

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm px-8 text-center gap-2 py-16">
        <p className="text-2xl">{filterUnread || filterTagId ? '🔍' : '💬'}</p>
        <p className="font-medium">
          {filterUnread
            ? 'Nenhuma mensagem não lida'
            : filterTagId
            ? 'Nenhuma conversa com essa tag'
            : 'Nenhuma conversa ainda'}
        </p>
        <p className="text-xs">
          {filterUnread
            ? 'Você está em dia com todas as conversas.'
            : filterTagId
            ? 'Aplique esta tag em conversas para filtrá-las aqui.'
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
