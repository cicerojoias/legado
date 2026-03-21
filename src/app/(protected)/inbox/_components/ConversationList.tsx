import { prisma } from '@/lib/prisma'
import { ConversationItem } from './ConversationItem'
import type { ConversationWithPreview } from './types'

interface ConversationListProps {
  activeId?: string
}

export async function ConversationList({ activeId }: ConversationListProps) {
  const conversations = await prisma.waConversation.findMany({
    orderBy: { last_message_at: 'desc' },
    include: {
      contact: true,
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
    take: 50,
  }) as ConversationWithPreview[]

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm px-8 text-center gap-2 py-16">
        <p className="text-2xl">💬</p>
        <p className="font-medium">Nenhuma conversa ainda</p>
        <p className="text-xs">As mensagens recebidas no WhatsApp aparecerão aqui.</p>
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
