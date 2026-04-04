import { Suspense } from 'react'
import { MessageCircle } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { ConversationList } from './_components/ConversationList'
import { ConversationSidebar } from './_components/ConversationSidebar'
import { listTags } from './actions/tag-catalog'

export const metadata = { title: 'Inbox — Legado' }
export const dynamic = 'force-dynamic'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; tag?: string }>
}) {
  const { filter, tag: filterTagId } = await searchParams
  const filterUnread = filter === 'unread'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const userId = user?.id ?? ''

  const [unreadTotal, tags, dbUser] = await Promise.all([
    prisma.waConversationRead.count({ where: { userId, unreadCount: { gt: 0 } } }),
    listTags(),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { role: true } }) : null,
  ])

  const listKey = `${filterUnread ? 'unread' : 'all'}-${filterTagId ?? 'notag'}`

  return (
    <div className="flex h-full">
      <ConversationSidebar unreadTotal={unreadTotal} tags={tags} userRole={dbUser?.role}>
        <Suspense key={listKey} fallback={<ConversationListSkeleton />}>
          <ConversationList filterUnread={filterUnread} filterTagId={filterTagId} />
        </Suspense>
      </ConversationSidebar>

      {/* Coluna de chat — só visível no desktop, vazia até selecionar */}
      <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <MessageCircle className="w-12 h-12 mx-auto opacity-20" />
          <p className="text-sm">Selecione uma conversa</p>
        </div>
      </div>
    </div>
  )
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-0 divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-12 h-12 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted animate-pulse rounded w-32" />
            <div className="h-3 bg-muted animate-pulse rounded w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}
