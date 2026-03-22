import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ChatWindow } from '../_components/ChatWindow'
import { ContactHeader } from '../_components/ContactHeader'
import { ConversationList } from '../_components/ConversationList'
import type { ConversationWithMessages } from '../_components/types'

interface PageProps {
  params: Promise<{ conversationId: string }>
}

export const dynamic = 'force-dynamic'

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params

  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      messages: { orderBy: { timestamp: 'asc' }, take: 100 },
    },
  }) as ConversationWithMessages | null

  if (!conversation) notFound()

  const { contact, messages } = conversation

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Lista de conversas — oculta no mobile, visível no desktop */}
      <div className="hidden md:flex md:w-[360px] md:border-r flex-col h-full overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-4 border-b">
          <span className="font-semibold text-lg">WhatsApp</span>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          <ConversationList activeId={conversationId} />
        </div>
      </div>

      {/* Área do chat — ocupa tela cheia no mobile.
          pb-16 md:pb-0: empurra o input acima do bottom nav mobile (4rem)
          sem criar gap scrollável externamente. */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0 pb-16 md:pb-0">
        <ContactHeader
          contact={contact}
          conversation={conversation}
          showBackButton
        />
        <ChatWindow
          conversationId={conversationId}
          initialMessages={messages}
        />
      </div>
    </div>
  )
}
