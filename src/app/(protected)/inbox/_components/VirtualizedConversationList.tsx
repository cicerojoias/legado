'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ConversationItem } from './ConversationItem'
import type { ConversationWithPreview } from './types'

interface VirtualizedConversationListProps {
  conversations: ConversationWithPreview[]
  activeId?: string
}

/**
 * Renderiza lista de conversas com virtualização via @tanstack/react-virtual
 * e suporte a paginação cursor-based sob rolagem (Scroll Infinito).
 */
export function VirtualizedConversationList({ conversations, activeId }: VirtualizedConversationListProps) {
  const [loadedConversations, setLoadedConversations] = useState<ConversationWithPreview[]>(conversations)
  const [hasMore, setHasMore] = useState(conversations.length === 50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadMoreRef = useRef(false)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el = document.getElementById('conversation-list-scroll')
    if (el) {
      setScrollElement(el)
    }
  }, [])

  const virtualizer = useVirtualizer({
    count: loadedConversations.length + (hasMore || isLoadingMore ? 1 : 0),
    getScrollElement: () => scrollElement,
    estimateSize: () => 72, // altura estimada de cada ConversationItem (~72px)
    overscan: 5,            // renderiza 5 itens extras acima/abaixo do viewport
  })

  // Sincroniza e mescla a lista de conversas vinda do servidor
  // (preserva itens já carregados no cliente e atualiza propriedades em tempo real)
  useEffect(() => {
    setLoadedConversations((prev) => {
      if (conversations.length === 0) return []

      const newMap = new Map(conversations.map((c) => [c.id, c]))

      // Atualiza os itens existentes
      const updatedPrev = prev.map((c) => {
        if (newMap.has(c.id)) {
          return newMap.get(c.id)!
        }
        return c
      })

      // Identifica itens totalmente novos no início da lista
      const prevIds = new Set(prev.map((c) => c.id))
      const brandNew = conversations.filter((c) => !prevIds.has(c.id))

      const merged = [...brandNew, ...updatedPrev]

      // Reordena por data da última mensagem decrescente
      return merged.sort((a, b) => {
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
        return dateB - dateA
      })
    })

    if (conversations.length < 50) {
      setHasMore(false)
    } else {
      setHasMore(true)
    }
  }, [conversations])

  // Busca a próxima página de conversas
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || loadMoreRef.current) return
    loadMoreRef.current = true
    setIsLoadingMore(true)

    try {
      const lastConv = loadedConversations[loadedConversations.length - 1]
      if (!lastConv || !lastConv.last_message_at) {
        setHasMore(false)
        return
      }

      const before = encodeURIComponent(new Date(lastConv.last_message_at).toISOString())
      const searchParams = new URLSearchParams(window.location.search)
      const filter = searchParams.get('filter') ?? ''
      const tag = searchParams.get('tag') ?? ''
      const status = searchParams.get('status') ?? 'all' // Inbox padrão exibe open e resolved, usamos 'all'

      const res = await fetch(
        `/api/whatsapp/conversations?status=${status}&filter=${filter}&tag=${tag}&before=${before}&limit=50`
      )

      if (!res.ok) throw new Error('Falha ao buscar mais conversas')

      const data = await res.json()
      const newConvs: ConversationWithPreview[] = data.conversations ?? []

      if (newConvs.length === 0) {
        setHasMore(false)
      } else {
        setLoadedConversations((prev) => {
          const existingIds = new Set(prev.map((c) => c.id))
          const unique = newConvs.filter((c) => !existingIds.has(c.id))
          return [...prev, ...unique]
        })
        setHasMore(newConvs.length === 50)
      }
    } catch (err) {
      console.error('[VirtualizedConversationList] Erro no loadMore:', err)
    } finally {
      setIsLoadingMore(false)
      loadMoreRef.current = false
    }
  }, [loadedConversations, hasMore, isLoadingMore])

  // Monitora a rolagem e ativa loadMore ao chegar perto do fim da lista
  const virtualItems = virtualizer.getVirtualItems()
  const lastItem = virtualItems[virtualItems.length - 1]

  useEffect(() => {
    if (
      lastItem &&
      lastItem.index >= loadedConversations.length - 2 &&
      hasMore &&
      !isLoadingMore
    ) {
      void loadMore()
    }
  }, [lastItem, loadedConversations.length, hasMore, isLoadingMore, loadMore])

  // Scrolla para o item ativo quando activeId muda
  useEffect(() => {
    if (!activeId) return
    const idx = loadedConversations.findIndex((c) => c.id === activeId)
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: 'center' })
    }
  }, [activeId, loadedConversations]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="divide-y divide-border/50">
      {/* Container interno com altura total virtual */}
      <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
        <div
          className="absolute top-0 left-0 w-full"
          style={{
            transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const isLoader = virtualItem.index === loadedConversations.length

            if (isLoader) {
              return (
                <div
                  key="loader-item"
                  ref={virtualizer.measureElement}
                  className="flex items-center justify-center py-4 text-muted-foreground text-xs bg-muted/10 border-t border-b"
                >
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                  Carregando mais conversas...
                </div>
              )
            }

            const conv = loadedConversations[virtualItem.index]
            if (!conv) return null

            return (
              <div
                key={conv.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
              >
                <ConversationItem
                  conversation={conv}
                  isActive={conv.id === activeId}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
