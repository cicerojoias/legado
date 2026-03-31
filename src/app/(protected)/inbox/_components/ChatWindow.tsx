'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import type { WaMessage } from '@prisma/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TemplateSelector } from './TemplateSelector'

const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 horas em ms
const PAGE_SIZE = 100
const BOTTOM_THRESHOLD = 150 // px — considera "no fundo" se dentro desse limite

interface ChatWindowProps {
  conversationId: string
  initialMessages: WaMessage[]
  initialHasMore: boolean
}

export function ChatWindow({ conversationId, initialMessages, initialHasMore }: ChatWindowProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<WaMessage[]>(initialMessages)
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; direction: string } | null>(null)

  const [pendingCount, setPendingCount] = useState(0)

  const bottomRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const isAtBottomRef = useRef(true)
  const rafRef = useRef<number | null>(null)

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [])

  const handleScroll = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const el = scrollContainerRef.current
      if (!el) return
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      isAtBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD
    })
  }, [])

  const handleJumpToBottom = useCallback(() => {
    scrollToBottom()
    setPendingCount(0)
    fetch(`/api/whatsapp/conversations/${conversationId}/mark-read`, { method: 'POST' }).catch(() => {})
  }, [conversationId, scrollToBottom])

  // Scroll inicial + reprocessar mídias pendentes ao abrir a conversa
  useEffect(() => {
    scrollToBottom(false)
    void fetch(`/api/whatsapp/reprocess-media?conversationId=${conversationId}`, { method: 'POST' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega a página anterior (mensagens mais antigas)
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return
    const oldest = messages[0]
    if (!oldest) return

    setIsLoadingMore(true)
    const el = scrollContainerRef.current
    const prevScrollHeight = el?.scrollHeight ?? 0
    const prevScrollTop = el?.scrollTop ?? 0

    try {
      const before = encodeURIComponent(new Date(oldest.timestamp).toISOString())
      const res = await fetch(`/api/whatsapp/conversations/${conversationId}?before=${before}`)
      if (!res.ok) return
      const data = await res.json()
      const older: WaMessage[] = data.conversation?.messages ?? []

      if (older.length === 0) {
        setHasMore(false)
        return
      }

      setHasMore(older.length === PAGE_SIZE)
      setMessages((prev) => {
        // Dedup por id — evita duplicatas se o cursor coincidir com um registro já carregado
        const existingIds = new Set(prev.map((m) => m.id))
        const unique = older.filter((m) => !existingIds.has(m.id))
        return [...unique, ...prev]
      })

      // Restaura âncora visual: mantém o viewport no mesmo ponto após o prepend
      requestAnimationFrame(() => {
        if (!el) return
        el.scrollTop = prevScrollTop + (el.scrollHeight - prevScrollHeight)
      })
    } catch {
      // silenciar erros de rede
    } finally {
      setIsLoadingMore(false)
    }
  }, [conversationId, hasMore, isLoadingMore, messages])

  // IntersectionObserver no sentinel do topo — dispara loadMore quando visível
  useEffect(() => {
    const sentinel = topSentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMore() },
      { root: scrollContainerRef.current, threshold: 0.1 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  // Realtime: escuta INSERT e UPDATE em wa_messages scoped pela conversation_id
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`wab-chat-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wa_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // Append direto — preserva mensagens antigas já carregadas via loadMore
          const newMsg = payload.new as unknown as WaMessage
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev
            return [...prev, newMsg]
          })
          if (isAtBottomRef.current) {
            scrollToBottom()
          } else if (newMsg.direction === 'inbound') {
            setPendingCount((prev) => prev + 1)
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wa_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string; mediaUrl: string | null }
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id
                ? { ...m, status: updated.status, mediaUrl: updated.mediaUrl ?? m.mediaUrl }
                : m
            )
          )
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[wab-realtime] subscribed', conversationId)
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[wab-realtime] erro ao subscrever', status, err)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [conversationId, scrollToBottom])

  // Listener para mensagens do Service Worker (notificationclick → NAVIGATE_TO)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handler = (event: MessageEvent<{ type?: string; url?: string }>) => {
      if (event.data?.type === 'NAVIGATE_TO' && typeof event.data.url === 'string') {
        router.push(event.data.url)
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [router])

  const windowExpired = useMemo(() => {
    const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound')
    if (!lastInbound) return true
    return Date.now() - new Date(lastInbound.timestamp).getTime() > WINDOW_MS
  }, [messages])

  const handleMessageSent = useCallback(() => {
    // Refetch das últimas 100 após envio (usuário está no fundo — não há perda de contexto)
    fetch(`/api/whatsapp/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        const fresh: WaMessage[] = data.conversation?.messages ?? []
        setMessages(fresh)
        setHasMore(data.hasMore ?? false)
        setPendingCount(0)
        scrollToBottom()
      })
      .catch(() => {})
  }, [conversationId, scrollToBottom])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Área de mensagens — scroll interno */}
      <div className="relative flex-1 min-h-0">
      <div ref={scrollContainerRef} onScroll={handleScroll} className="h-full overflow-y-auto px-4 py-4 space-y-2">
        {/* Sentinel do topo: ativa loadMore via IntersectionObserver */}
        <div ref={topSentinelRef} className="h-1" />

        {/* Indicador de carregamento */}
        {isLoadingMore && (
          <div className="flex justify-center py-2">
            <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Sem mensagens ainda
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onReply={() => setReplyTo({
                id: msg.id,
                content: msg.content ?? '[Mídia]',
                direction: msg.direction,
              })}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Botão flutuante "↓ N novas" — visível quando scrollado para cima e há mensagens pendentes */}
      {pendingCount > 0 && (
        <button
          onClick={handleJumpToBottom}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 shadow-lg hover:bg-primary/90 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          {pendingCount}
        </button>
      )}
      </div>

      {windowExpired ? (
        <TemplateSelector conversationId={conversationId} onMessageSent={handleMessageSent} />
      ) : (
        <MessageInput
          conversationId={conversationId}
          onMessageSent={handleMessageSent}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
        />
      )}
    </div>
  )
}
