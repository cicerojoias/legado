import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createServerTiming } from '@/lib/server-timing'
import { ChatWindow } from '../_components/ChatWindow'
import { ContactHeader } from '../_components/ContactHeader'
import { ConversationNotesPanel } from '../_components/ConversationNotesPanel'
import { SelectionProvider } from '../_components/SelectionContext'
import { InsertTextProvider } from '../_components/InsertTextContext'
import { INITIAL_MESSAGES } from '../_components/chat-constants'
import type { ConversationNoteWithAuthor } from '../_components/types'

interface PageProps {
  params: Promise<{ conversationId: string }>
}

export const dynamic = 'force-dynamic'

/**
 * Só os dados da conversa, em paralelo. Sidebar/lista/tags/role vêm do layout (já carregado),
 * auth + RBAC ficam no middleware e a leitura (unread) é marcada pelo ChatWindow via mark-read.
 * Mensagens mais antigas são carregadas sob demanda ao rolar para cima.
 */
export default async function ConversationPage({ params }: PageProps) {
  const { conversationId } = await params
  const timing = createServerTiming('inbox/chat-page')

  const [conversation, rawMessages, notes] = await Promise.all([
    timing.measure('conversation', prisma.waConversation.findUnique({
      where: { id: conversationId },
      include: {
        contact: true,
        conversation_tags: {
          include: { tag: true },
          orderBy: { assignedAt: 'asc' },
        },
      },
    })),
    timing.measure('messages', prisma.waMessage.findMany({
      where: { conversation_id: conversationId },
      orderBy: { timestamp: 'desc' },
      take: INITIAL_MESSAGES + 1,
    })),
    timing.measure('notes', prisma.waConversationNote.findMany({
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
    }) as Promise<ConversationNoteWithAuthor[]>),
  ])
  timing.log()

  if (!conversation) notFound()

  const initialHasMore = rawMessages.length > INITIAL_MESSAGES
  const messages = rawMessages.slice(0, INITIAL_MESSAGES).reverse()

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <InsertTextProvider>
        <SelectionProvider>
          <ContactHeader
            contact={conversation.contact}
            conversation={conversation}
            showBackButton
            currentTags={conversation.conversation_tags}
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
  )
}
