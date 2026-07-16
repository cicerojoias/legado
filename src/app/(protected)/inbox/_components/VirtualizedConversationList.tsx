'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ConversationItem } from './ConversationItem'
import type { ConversationWithPreview } from './types'

interface VirtualizedConversationListProps {
  conversations: ConversationWithPreview[]
  activeId?: string
  userId?: string
}

/**
 * Renderiza lista de conversas com virtualização via @tanstack/react-virtual
 * e suporte a paginação cursor-based sob rolagem (Scroll Infinito).
 */
export function VirtualizedConversationList({ conversations, activeId, userId }: VirtualizedConversationListProps) {
  const [loadedConversations, setLoadedConversations] = useState<ConversationWithPreview[]>(conversations)
  const [hasMore, setHasMore] = useState(conversations.length === 50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const loadMoreRef = useRef(false)
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

  // Ouvir eventos realtime client-side e atualizar estado interno localmente
  useEffect(() => {
    const handleNewMessage = async (e: Event) => {
      const customEvent = e as CustomEvent<ConversationWithPreview['messages'][number]>
      const newMsg = customEvent.detail
      if (!newMsg) return

      setLoadedConversations((prev) => {
        const index = prev.findIndex((c) => c.id === newMsg.conversation_id)
        if (index >= 0) {
          const updated = [...prev]
          const conv = { ...updated[index] }
          conv.last_message_at = newMsg.timestamp
          conv.messages = [newMsg]
          updated[index] = conv
          return updated.sort((a, b) => {
            const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
            const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
            return dateB - dateA
          })
        } else {
          // Conversa totalmente nova ou fora do Top 50 carregado inicialmente. Busca dados completos da API.
          fetch(`/api/whatsapp/conversations?conversationId=${newMsg.conversation_id}`)
            .then((res) => {
              if (res.ok) return res.json()
            })
            .then((data) => {
              const fetchedConv = data?.conversations?.[0]
              if (fetchedConv) {
                setLoadedConversations((current) => {
                  if (current.some((c) => c.id === fetchedConv.id)) return current
                  const updated = [fetchedConv, ...current]
                  return updated.sort((a, b) => {
                    const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
                    const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
                    return dateB - dateA
                  })
                })
              }
            })
            .catch((err) => console.error('[VirtualizedConversationList] Erro ao buscar nova conversa:', err))
          return prev
        }
      })
    }

    const handleMessageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Pick<ConversationWithPreview['messages'][number], 'id' | 'conversation_id' | 'status' | 'reaction' | 'type' | 'content' | 'mediaUrl'>>
      const updated = customEvent.detail
      if (!updated) return

      setLoadedConversations((prev) => {
        const index = prev.findIndex((c) => c.id === updated.conversation_id)
        if (index >= 0) {
          const updatedList = [...prev]
          const conv = { ...updatedList[index] }
          const lastMsg = conv.messages[0]
          if (lastMsg && lastMsg.id === updated.id) {
            conv.messages = [{
              ...lastMsg,
              status: updated.status,
              reaction: updated.reaction,
              type: updated.type,
              content: updated.content,
              mediaUrl: updated.mediaUrl
            }]
            updatedList[index] = conv
            return updatedList
          }
        }
        return prev
      })
    }

    const handleConversationUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<Partial<ConversationWithPreview> & Pick<ConversationWithPreview, 'id'>>
      const updatedConv = customEvent.detail
      if (!updatedConv) return

      setLoadedConversations((prev) => {
        const index = prev.findIndex((c) => c.id === updatedConv.id)
        if (index >= 0) {
          const updatedList = [...prev]
          updatedList[index] = {
            ...updatedList[index],
            ...updatedConv,
          }
          return updatedList
        }
        return prev
      })
    }

    const handleConversationReadUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ conversationId: string; unreadCount: number; userId: string }>
      const updatedRead = customEvent.detail
      if (!updatedRead) return

      // Apenas atualiza se for correspondente ao usuário logado
      if (userId && updatedRead.userId !== userId) return

      setLoadedConversations((prev) => {
        const index = prev.findIndex((c) => c.id === updatedRead.conversationId)
        if (index >= 0) {
          const updatedList = [...prev]
          updatedList[index] = {
            ...updatedList[index],
            unreadCount: updatedRead.unreadCount,
          }
          return updatedList
        }
        return prev
      })
    }

    window.addEventListener('wab-new-message', handleNewMessage)
    window.addEventListener('wab-message-update', handleMessageUpdate)
    window.addEventListener('wab-conversation-update', handleConversationUpdate)
    window.addEventListener('wab-conversation-read-update', handleConversationReadUpdate)

    return () => {
      window.removeEventListener('wab-new-message', handleNewMessage)
      window.removeEventListener('wab-message-update', handleMessageUpdate)
      window.removeEventListener('wab-conversation-update', handleConversationUpdate)
      window.removeEventListener('wab-conversation-read-update', handleConversationReadUpdate)
    }
  }, [userId])

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
      // Acha a última conversa que possui data válida para servir de cursor
      const lastConvWithDate = [...loadedConversations]
        .reverse()
        .find((c) => c.last_message_at)

      if (!lastConvWithDate || !lastConvWithDate.last_message_at) {
        setHasMore(false)
        return
      }

      const before = encodeURIComponent(new Date(lastConvWithDate.last_message_at).toISOString())
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
