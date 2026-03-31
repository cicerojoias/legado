import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { ChatWindow } from '../_components/ChatWindow'
import { ContactHeader } from '../_components/ContactHeader'
import { ConversationList } from '../_components/ConversationList'
import { ConversationSidebar } from '../_components/ConversationSidebar'
import type { ConversationWithMessages } from '../_components/types'

interface PageProps {
  params: Promise<{ conversationId: string }>
}

export const dynamic = 'force-dynamic'

export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params

  // Mark conversation as read para o usuário atual — fire-and-forget, não bloqueia o render
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    prisma.waConversationRead.upsert({
      where: { userId_conversationId: { userId: user.id, conversationId } },
      update: { unreadCount: 0, lastReadAt: new Date() },
      create: { userId: user.id, conversationId, unreadCount: 0 },
    }).catch(() => {})
  }

  const rawMessages = await prisma.waMessage.findMany({
    where: { conversation_id: conversationId },
    orderBy: { timestamp: 'desc' },
    take: 101,
  })
  const initialHasMore = rawMessages.length > 100
  const messages = rawMessages.slice(0, 100).reverse()

  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  }) as (ConversationWithMessages & { messages: typeof messages }) | null

  if (!conversation) notFound()

  const { contact } = conversation

  return (
    <div className="flex h-full">
      {/* Lista de conversas — oculta no mobile, visível no desktop */}
      <div className="hidden md:flex">
        <ConversationSidebar activeId={conversationId}>
          <Suspense fallback={null}>
            <ConversationList activeId={conversationId} />
          </Suspense>
        </ConversationSidebar>
      </div>

      {/* Área do chat — ocupa tela cheia no mobile */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <ContactHeader
          contact={contact}
          conversation={conversation}
          showBackButton
        />
        <ChatWindow
          conversationId={conversationId}
          initialMessages={messages}
          initialHasMore={initialHasMore}
        />
      </div>
    </div>
  )
}
