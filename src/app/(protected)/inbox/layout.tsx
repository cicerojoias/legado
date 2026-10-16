import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createServerTiming } from '@/lib/server-timing'
import { ConversationListRealtimeSync } from './_components/ConversationListRealtimeSync'
import { ConversationList } from './_components/ConversationList'
import { ConversationSidebar } from './_components/ConversationSidebar'
import { ConversationListSkeleton } from './_components/InboxConversationList'
import { InboxDataProvider } from './_components/InboxDataContext'
import { InboxShell } from './_components/InboxShell'
import { listTags } from './actions/tag-catalog'
import { getSettings } from './actions/settings'

export const dynamic = 'force-dynamic'

/**
 * O layout carrega sidebar + lista uma única vez. Layouts não re-renderizam ao navegar
 * entre /inbox e /inbox/[id], então abrir/trocar/sair de conversa não refaz essas queries.
 */
export default async function InboxLayout({ children }: { children: React.ReactNode }) {
  const timing = createServerTiming('inbox/layout')
  const supabase = await createClient()
  const { data: { user } } = await timing.measure('auth', supabase.auth.getUser())
  const userId = user?.id ?? ''

  const [unreadTotal, tags, dbUser, settings] = await timing.measure('sidebar-data', Promise.all([
    prisma.waConversationRead.count({ where: { userId, unreadCount: { gt: 0 } } }),
    listTags(),
    userId ? prisma.user.findUnique({ where: { id: userId }, select: { role: true } }) : null,
    getSettings(),
  ]))
  timing.log()

  return (
    <InboxDataProvider value={{ userId, role: dbUser?.role ?? null, tags }}>
      <ConversationListRealtimeSync />
      <InboxShell
        sidebar={
          <ConversationSidebar unreadTotal={unreadTotal} tags={tags} userRole={dbUser?.role} initialSettings={settings}>
            <Suspense fallback={<ConversationListSkeleton />}>
              <ConversationList userId={userId} />
            </Suspense>
          </ConversationSidebar>
        }
      >
        {children}
      </InboxShell>
    </InboxDataProvider>
  )
}
