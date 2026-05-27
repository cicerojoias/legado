'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { cn, parseMessageTimestamp } from '@/lib/utils'
import type { WaMessage } from '@prisma/client'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TemplateSelector } from './TemplateSelector'
import { AssistenteModal } from './AssistenteModal'
import { useSelectionState, useSelectionActions } from './SelectionContext'
import { useInsertText } from './InsertTextContext'

const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 horas em ms
const REACTIONS = ['✅', '💚', '🤝', '🙏'] as const
const PAGE_SIZE = 100
const BOTTOM_THRESHOLD = 150 // px — considera "no fundo" se dentro desse limite

function getLocalDateString(dateInput: Date | string | null): string {
  if (!dateInput) return ''
  const d = parseMessageTimestamp(dateInput)
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(d) // "YYYY-MM-DD"
}

function getDateLabel(dateInput: Date | string | null): string {
  if (!dateInput) return ''
  const d = parseMessageTimestamp(dateInput)
  const now = new Date()

  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/Recife',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const dStr = fmt.format(d)
  const nowStr = fmt.format(now)

  if (dStr === nowStr) return 'Hoje'

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = fmt.format(yesterday)

  if (dStr === yesterdayStr) return 'Ontem'

  return d.toLocaleDateString('pt-BR', {
    timeZone: 'America/Recife',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface ChatWindowProps {
  conversationId: string
  initialMessages: WaMessage[]
  initialHasMore: boolean
}

export function ChatWindow({ conversationId, initialMessages, initialHasMore }: ChatWindowProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<WaMessage[]>(initialMessages)
  const messagesRef = useRef<WaMessage[]>(messages)
  messagesRef.current = messages

  const [hasMore, setHasMore] = useState(initialHasMore)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const isLoadingMoreRef = useRef(false) // ref anti-stale-closure
  const isSearchingAndScrollingRef = useRef(false)
  const [loadError, setLoadError] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; direction: string } | null>(null)
  const [assistenteOpen, setAssistenteOpen] = useState(false)

  // Controle de data flutuante
  const [isFloatingDateVisible, setIsFloatingDateVisible] = useState(false)
  const [floatingDateLabel, setFloatingDateLabel] = useState('')
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [pendingCount, setPendingCount] = useState(0)
  const reactingRef = useRef<Set<string>>(new Set())

  const { active: selectionActive, selected: selectedMessages } = useSelectionState()
  const { clear: clearSelection } = useSelectionActions()
  const { requestInsert } = useInsertText()

  // Extrair contexto das ultimas 10 mensagens para o Assistente IA
  const conversationContext = useMemo(() => {
    const lastMessages = messages.slice(-10)
    return lastMessages
      .filter((msg) => msg.content) // Apenas mensagens com conteudo textual
      .map((msg) => {
        const sender = msg.direction === 'inbound' ? 'Cliente' : 'Atendente'
        return `[${sender}]: ${msg.content}`
      })
      .join('\n\n')
  }, [messages])

  // Barra de reação flutuante — só quando exatamente 1 mensagem selecionada
  const reactionBarMsgId = selectionActive && selectedMessages.size === 1
    ? [...selectedMessages.keys()][0]
    : null
  const reactionBarMsg = reactionBarMsgId
    ? messages.find(m => m.id === reactionBarMsgId) ?? null
    : null

  const bottomRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
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

      // A. Controle do AtBottom
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      isAtBottomRef.current = distanceFromBottom <= BOTTOM_THRESHOLD

      // B. Controle do Indicador de Data Flutuante
      const isScrollable = el.scrollHeight > el.clientHeight
      if (!isScrollable || el.scrollTop <= 10) {
        setIsFloatingDateVisible(false)
        return
      }

      setIsFloatingDateVisible(true)

      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = setTimeout(() => {
        setIsFloatingDateVisible(false)
      }, 1500)

      // Identificar qual balão está no topo do viewport
      const containerRect = el.getBoundingClientRect()
      const bubbles = el.getElementsByClassName('message-bubble-item')
      let activeMsgTimestamp: string | null = null

      for (let i = 0; i < bubbles.length; i++) {
        const bubble = bubbles[i] as HTMLElement
        const rect = bubble.getBoundingClientRect()
        // Threshold de 40px a partir do topo do container de scroll
        if (rect.top - containerRect.top <= 40) {
          activeMsgTimestamp = bubble.getAttribute('data-timestamp')
        } else {
          break
        }
      }

      if (activeMsgTimestamp) {
        setFloatingDateLabel(getDateLabel(activeMsgTimestamp))
      }
    })
  }, [])

  // Limpar timeout do scroll ao desmontar
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current)
    }
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
    // Marca mensagens como lidas ao abrir a conversa
    fetch(`/api/whatsapp/conversations/${conversationId}/mark-read`, { method: 'POST' }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Carrega a página anterior (mensagens mais antigas)
  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current || isSearchingAndScrollingRef.current || !hasMore) return
    const oldest = messages[0]
    if (!oldest) return

    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    setLoadError(false)
    const el = scrollContainerRef.current
    const prevScrollHeight = el?.scrollHeight ?? 0
    const prevScrollTop = el?.scrollTop ?? 0

    // Snapshot do estado pré-load para rollback em caso de erro parcial
    const prevHasMore = hasMore
    const prevMessages = messages

    try {
      const before = encodeURIComponent(parseMessageTimestamp(oldest.timestamp).toISOString())
      const res = await fetch(`/api/whatsapp/conversations/${conversationId}?before=${before}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
    } catch (err) {
      console.error('[ChatWindow] loadMore error:', err)
      // Rollback: restaura estado pré-load para consistência
      setHasMore(prevHasMore)
      setMessages(prevMessages)
      setLoadError(true)
    } finally {
      isLoadingMoreRef.current = false
      setIsLoadingMore(false)
    }
  }, [conversationId, hasMore, messages])

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

  // Realtime: escuta eventos globais emitidos pelo centralizador central ConversationListRealtimeSync
  useEffect(() => {
    console.log(`[wab-realtime-chat] Iniciando escuta de eventos para conversa: ${conversationId}`)

    const handleGlobalNewMessage = (e: Event) => {
      const customEvent = e as CustomEvent<WaMessage>
      const newMsg = customEvent.detail
      if (newMsg && newMsg.conversation_id === conversationId) {
        console.log(`[wab-realtime-chat] Nova mensagem recebida via evento global na conversa ${conversationId}:`, newMsg)
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
    }

    const handleGlobalMessageUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{
        id: string
        conversation_id: string
        status: string
        mediaUrl: string | null
        reaction: string | null
        type: string
        content: string | null
      }>
      const updated = customEvent.detail
      if (updated && updated.conversation_id === conversationId) {
        console.log(`[wab-realtime-chat] Mensagem atualizada recebida via evento global na conversa ${conversationId}:`, updated)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === updated.id
              ? {
                  ...m,
                  status: updated.status,
                  mediaUrl: updated.type === 'deleted' ? null : (updated.mediaUrl ?? m.mediaUrl),
                  reaction: updated.type === 'deleted' ? null : updated.reaction,
                  type: updated.type,
                  content: updated.type === 'deleted' ? null : updated.content,
                }
              : m
          )
        )
      }
    }

    window.addEventListener('wab-new-message', handleGlobalNewMessage)
    window.addEventListener('wab-message-update', handleGlobalMessageUpdate)

    return () => {
      console.log(`[wab-realtime-chat] Removendo escuta de eventos para conversa: ${conversationId}`)
      window.removeEventListener('wab-new-message', handleGlobalNewMessage)
      window.removeEventListener('wab-message-update', handleGlobalMessageUpdate)
    }
  }, [conversationId, scrollToBottom])

  // Escutar evento de scroll até mensagem específica (busca de palavras)
  useEffect(() => {
    const handleScrollToMessage = async (e: Event) => {
      const customEvent = e as CustomEvent<{ messageId: string; timestamp: string }>
      const { messageId } = customEvent.detail
      
      console.log(`[wab-search-scroll] Buscando rolar até a mensagem ${messageId}`)

      const currentMessagesSnapshot = messagesRef.current
      const exists = currentMessagesSnapshot.some((m) => m.id === messageId)

      if (exists) {
        const element = document.getElementById(`msg-${messageId}`)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          element.classList.add('animate-highlight-pulse')
          setTimeout(() => {
            element.classList.remove('animate-highlight-pulse')
          }, 2200)
        }
      } else {
        // Bloqueia qualquer carregamento automático pelo sentinela do topo
        isSearchingAndScrollingRef.current = true
        setIsLoadingMore(true)
        isLoadingMoreRef.current = true

        try {
          let currentMessages = [...currentMessagesSnapshot]
          let oldest = currentMessages[0]
          let found = false
          let iterations = 0 // segurança contra loops infinitos

          while (!found && oldest && iterations < 15) {
            iterations++
            const before = encodeURIComponent(parseMessageTimestamp(oldest.timestamp).toISOString())
            const res = await fetch(`/api/whatsapp/conversations/${conversationId}?before=${before}`)
            if (!res.ok) break
            const data = await res.json()
            const older: WaMessage[] = data.conversation?.messages ?? []
            if (older.length === 0) break

            const existingIds = new Set(currentMessages.map((m) => m.id))
            const unique = older.filter((m) => !existingIds.has(m.id))
            
            // Se nenhuma mensagem nova foi retornada, interrompe para evitar loop no mesmo cursor
            if (unique.length === 0) break

            currentMessages = [...unique, ...currentMessages]
            oldest = currentMessages[0]

            if (currentMessages.some((m) => m.id === messageId)) {
              found = true
              break
            }

            if (older.length < PAGE_SIZE) break
          }

          setMessages(currentMessages)
          setHasMore(oldest ? true : false)

          // Rola e destaca após re-renderização
          setTimeout(() => {
            const element = document.getElementById(`msg-${messageId}`)
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
              element.classList.add('animate-highlight-pulse')
              setTimeout(() => {
                element.classList.remove('animate-highlight-pulse')
              }, 2200)
            }
            
            // Libera o carregamento automático apenas após a rolagem estar estável
            setTimeout(() => {
              isSearchingAndScrollingRef.current = false
              setIsLoadingMore(false)
              isLoadingMoreRef.current = false
            }, 600)
          }, 200)
        } catch (err) {
          console.error('[wab-search-scroll] Erro ao carregar mensagens históricas:', err)
          isSearchingAndScrollingRef.current = false
          setIsLoadingMore(false)
          isLoadingMoreRef.current = false
        }
      }
    }

    window.addEventListener('wab-scroll-to-message', handleScrollToMessage)
    return () => {
      window.removeEventListener('wab-scroll-to-message', handleScrollToMessage)
    }
  }, [conversationId])

  const windowExpired = useMemo(() => {
    const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound')
    if (!lastInbound) return true
    return Date.now() - new Date(lastInbound.timestamp).getTime() > WINDOW_MS
  }, [messages])

  const handleReact = useCallback((messageId: string, emoji: string) => {
    // Dedup — ignora se já há uma requisição em andamento para esta mensagem
    if (reactingRef.current.has(messageId)) return
    reactingRef.current.add(messageId)

    // Atualização otimista imediata
    setMessages((prev) =>
      prev.map((m) => m.id === messageId ? { ...m, reaction: emoji || null } : m)
    )

    fetch('/api/whatsapp/react', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, emoji }),
    })
      .catch(() => {
        // Reverter em caso de erro
        setMessages((prev) =>
          prev.map((m) => m.id === messageId ? { ...m, reaction: m.reaction } : m)
        )
      })
      .finally(() => { reactingRef.current.delete(messageId) })
  }, [])

  const handleMessageSent = useCallback(() => {
    // O envio já publica INSERT/UPDATE via realtime; só garante que a bolha fique visível.
    scrollToBottom()
  }, [scrollToBottom])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Área de mensagens — scroll interno */}
      <div className="relative flex-1 min-h-0">
        {/* Indicador de Data Flutuante (WhatsApp/Telegram Style) */}
        <div
          className={cn(
            'absolute top-2 left-0 right-0 flex justify-center z-20 pointer-events-none transition-opacity duration-300',
            isFloatingDateVisible ? 'opacity-100' : 'opacity-0'
          )}
        >
          <span className="bg-card/95 border backdrop-blur text-muted-foreground text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-md">
            {floatingDateLabel}
          </span>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          style={{ overflowAnchor: 'auto' }}
          className={cn(
            'h-full overflow-y-auto overflow-x-hidden overscroll-y-none px-4 py-4 space-y-2',
            selectionActive && 'select-none'
          )}
        >
          {/* Sentinel do topo: ativa loadMore via IntersectionObserver */}
          <div ref={topSentinelRef} className="h-1" style={{ overflowAnchor: 'none' }} />

          {/* Indicador de carregamento */}
          {isLoadingMore && (
            <div className="flex justify-center py-2" style={{ overflowAnchor: 'none' }}>
              <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          )}

          {/* Erro ao carregar — botão de retry */}
          {loadError && (
            <div className="flex justify-center py-2" style={{ overflowAnchor: 'none' }}>
              <button
                onClick={() => loadMore()}
                className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors"
              >
                Erro ao carregar — toque para tentar novamente
              </button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Sem mensagens ainda
            </div>
          ) : (
            messages.flatMap((msg, index) => {
              const prevMsg = index > 0 ? messages[index - 1] : null
              const dateStr = getLocalDateString(msg.timestamp)
              const prevDateStr = prevMsg ? getLocalDateString(prevMsg.timestamp) : null
              const showSeparator = dateStr !== prevDateStr

              const elements = []
              if (showSeparator) {
                elements.push(
                  <div
                    key={`sep-${msg.id}`}
                    className="flex justify-center my-2"
                  >
                    <span className="bg-card/85 border backdrop-blur text-muted-foreground text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                      {getDateLabel(msg.timestamp)}
                    </span>
                  </div>
                )
              }
              elements.push(
                <div
                  key={msg.id}
                  className="message-bubble-item"
                  data-timestamp={msg.timestamp.toString()}
                >
                  <MessageBubble
                    message={msg}
                    onReply={() => setReplyTo({
                      id: msg.id,
                      content: msg.content ?? '[Mídia]',
                      direction: msg.direction,
                    })}
                    onReact={(emoji) => handleReact(msg.id, emoji)}
                  />
                </div>
              )
              return elements
            })
          )}
          <div ref={bottomRef} />
        </div>

      {/* Botão flutuante "↓ N novas" */}
      {pendingCount > 0 && (
        <button
          onClick={handleJumpToBottom}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1.5 shadow-lg hover:bg-primary/90 transition-colors"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          {pendingCount}
        </button>
      )}

      {/* Barra de reação flutuante — estilo WhatsApp, aparece com 1 msg selecionada */}
      {reactionBarMsgId && reactionBarMsg && (
        <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20 pointer-events-none">
          <div className="pointer-events-auto bg-background border rounded-full shadow-2xl px-2 py-1.5 flex items-center gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  handleReact(reactionBarMsgId, reactionBarMsg.reaction === emoji ? '' : emoji)
                  clearSelection()
                }}
                className={cn(
                  'w-11 h-11 flex items-center justify-center rounded-full text-2xl transition-transform active:scale-90 hover:bg-muted',
                  reactionBarMsg.reaction === emoji && 'bg-primary/10 ring-2 ring-primary/30'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
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
          onOpenAssistente={() => setAssistenteOpen(true)}
        />
      )}

      {/* Modal do Assistente IA */}
      <AssistenteModal
        open={assistenteOpen}
        onClose={() => setAssistenteOpen(false)}
        onAccept={(text: string) => requestInsert(text)}
        conversationContext={conversationContext || undefined}
      />
    </div>
  )
}
