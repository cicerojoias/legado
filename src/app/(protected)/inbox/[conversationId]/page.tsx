import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { ChatWindow } from '../_components/ChatWindow'
import { ContactHeader } from '../_components/ContactHeader'
import { ConversationNotesPanel } from '../_components/ConversationNotesPanel'
import { ConversationList } from '../_components/ConversationList'
import { ConversationSidebar } from '../_components/ConversationSidebar'
import { SelectionProvider } from '../_components/SelectionContext'
import { InsertTextProvider } from '../_components/InsertTextContext'
import { listTags } from '../actions/tag-catalog'
import { getSettings } from '../actions/settings'
import type { ConversationNoteWithAuthor, ConversationWithMessages } from '../_components/types'

interface PageProps {
  params: Promise<{ conversationId: string }>
  searchParams: Promise<{ filter?: string; tag?: string }>
}

export const dynamic = 'force-dynamic'

export default async function ConversationPage({ params, searchParams }: PageProps) {
  const [{ conversationId }, { filter, tag: filterTagId }] = await Promise.all([params, searchParams])
  const filterUnread = filter === 'unread'

  // Mark conversation as read para o usuário atual — fire-and-forget, não bloqueia o render
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  if (user) {
    prisma.waConversationRead.upsert({
      where: { userId_conversationId: { userId: user.id, conversationId } },
      update: { unreadCount: 0, lastReadAt: new Date() },
      create: { userId: user.id, conversationId, unreadCount: 0 },
    }).catch(() => {})
  }

  const [unreadTotal, tags, dbUser, settings] = await Promise.all([
    prisma.waConversationRead.count({ where: { userId, unreadCount: { gt: 0 } } }),
    listTags(),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { role: true } }) : null,
    getSettings(),
  ])

  const rawMessages = await prisma.waMessage.findMany({
    where: { conversation_id: conversationId },
    orderBy: { timestamp: 'desc' },
    take: 101,
  })
  const initialHasMore = rawMessages.length > 100
  const messages = rawMessages.slice(0, 100).reverse()

  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      conversation_tags: {
        include: { tag: true },
        orderBy: { assignedAt: 'asc' },
      },
    },
  }) as (ConversationWithMessages & { messages: typeof messages }) | null

  if (!conversation) notFound()

  const notes = await prisma.waConversationNote.findMany({
    where: {
      conversation_id: conversationId,
      deleted_at: null,
    },
    orderBy: { created_at: 'asc' },
    include: {
      author: {
        select: {
          id: true,
          nome: true,
          email: true,
        },
      },
    },
  }) as ConversationNoteWithAuthor[]

  const { contact } = conversation

  return (
    <div className="flex h-full">
      {/* Lista de conversas — oculta no mobile, visível no desktop */}
      <div className="hidden md:flex">
        <ConversationSidebar activeId={conversationId} unreadTotal={unreadTotal} tags={tags} userRole={dbUser?.role} initialSettings={settings}>
          <Suspense key={`${filterUnread ? 'unread' : 'all'}-${filterTagId ?? 'notag'}`} fallback={null}>
            <ConversationList activeId={conversationId} filterUnread={filterUnread} filterTagId={filterTagId} />
          </Suspense>
        </ConversationSidebar>
      </div>

      {/* Área do chat — ocupa tela cheia no mobile */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <InsertTextProvider>
          <SelectionProvider>
            <ContactHeader
              contact={contact}
              conversation={conversation}
              showBackButton
              currentTags={(conversation as { conversation_tags?: import('../_components/types').TagWithMeta[] }).conversation_tags ?? []}
              availableTags={dbUser?.role !== 'OPERADOR' ? tags : []}
            />
            <ConversationNotesPanel conversationId={conversationId} initialNotes={notes} />
            <ChatWindow
              conversationId={conversationId}
              initialMessages={messages}
              initialHasMore={initialHasMore}
            />
          </SelectionProvider>
        </InsertTextProvider>
      </div>
    </div>
  )
}
