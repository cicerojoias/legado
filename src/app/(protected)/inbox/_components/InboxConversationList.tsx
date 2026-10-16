'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { VirtualizedConversationList } from './VirtualizedConversationList'
import type { ConversationWithPreview } from './types'

const DEFAULT_KEY = 'all-notag'

interface InboxConversationListProps {
  initialConversations: ConversationWithPreview[]
  userId: string
}

/**
 * Lista de conversas client-side: como vive no layout (que não recebe searchParams),
 * os filtros (não lidas / tag) são buscados na API. A lista padrão vem do servidor.
 */
export function InboxConversationList({ initialConversations, userId }: InboxConversationListProps) {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const filterUnread = searchParams.get('filter') === 'unread'
  const filterTagId = searchParams.get('tag') ?? ''
  const key = `${filterUnread ? 'unread' : 'all'}-${filterTagId || 'notag'}`
  const activeId = pathname.startsWith('/inbox/') ? pathname.split('/')[2] : undefined

  const [lists, setLists] = useState<Record<string, ConversationWithPreview[]>>({})
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const skipInitialFetch = useRef(key === DEFAULT_KEY)

  useEffect(() => {
    // A lista padrão do primeiro render já veio do servidor; trocas posteriores revalidam via API
    if (skipInitialFetch.current) {
      skipInitialFetch.current = false
      return
    }

    let cancelled = false
    const isFiltered = filterUnread || !!filterTagId
    const qs = new URLSearchParams({ status: 'all', limit: isFiltered ? '1000' : '50' })
    if (filterUnread) qs.set('filter', 'unread')
    if (filterTagId) qs.set('tag', filterTagId)

    fetch(`/api/whatsapp/conversations?${qs}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((data: { conversations: ConversationWithPreview[] }) => {
        if (!cancelled) setLists((prev) => ({ ...prev, [key]: data.conversations }))
      })
      .catch((err) => {
        console.error('[InboxConversationList] Erro ao carregar lista:', err)
        if (!cancelled) setErrorKey(key)
      })

    return () => { cancelled = true }
  }, [key, filterUnread, filterTagId])

  const conversations = lists[key] ?? (key === DEFAULT_KEY ? initialConversations : null)
  const loadError = errorKey === key

  if (!conversations) {
    return loadError
      ? <p className="py-12 text-center text-sm text-muted-foreground">Erro ao carregar conversas.</p>
      : <ConversationListSkeleton />
  }

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
    <VirtualizedConversationList
      key={key}
      conversations={conversations}
      activeId={activeId}
      userId={userId}
    />
  )
}

export function ConversationListSkeleton() {
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
