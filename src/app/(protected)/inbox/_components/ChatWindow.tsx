'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { WaMessage } from '@prisma/client'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TemplateSelector } from './TemplateSelector'

const WINDOW_MS = 24 * 60 * 60 * 1000 // 24 horas em ms

interface ChatWindowProps {
  conversationId: string
  initialMessages: WaMessage[]
}

export function ChatWindow({ conversationId, initialMessages }: ChatWindowProps) {
  const router = useRouter()
  const [messages, setMessages] = useState<WaMessage[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollContainerRef.current
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      // requestAnimationFrame garante que o browser finalizou o layout antes de scrollar
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight
      })
    }
  }, [])

  // Scroll inicial + reprocessar mídias pendentes ao abrir a conversa
  useEffect(() => {
    scrollToBottom(false)
    // Dispara reprocessamento de mídias que falharam no after() — não bloqueia UI
    void fetch(`/api/whatsapp/reprocess-media?conversationId=${conversationId}`, { method: 'POST' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling: busca novas mensagens a cada 5s
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/whatsapp/conversations/${conversationId}`)
        if (!res.ok) return
        const data = await res.json()
        const fresh: WaMessage[] = data.conversation?.messages ?? []
        setMessages((prev) => {
          const hasNew = fresh.length > prev.length
          const hasMediaUpdate = fresh.some(
            (msg, i) => prev[i] && (prev[i].mediaUrl !== msg.mediaUrl || prev[i].status !== msg.status)
          )
          if (!hasNew && !hasMediaUpdate) return prev
          if (hasNew) scrollToBottom()
          return fresh
        })
      } catch {
        // Silenciar erros de rede durante polling
      }
    }

    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [conversationId, scrollToBottom])

  // Listener para mensagens do Service Worker (notificationclick → NAVIGATE_TO)
  // Quando o usuário clica numa notificação estando em outra conversa, navega para a correta.
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

  // Detecta se a janela de 24h está expirada.
  // A janela é aberta pela última mensagem INBOUND do contato.
  // Se não há inbound ou o último é > 24h, só templates são permitidos.
  const windowExpired = useMemo(() => {
    const lastInbound = [...messages].reverse().find((m) => m.direction === 'inbound')
    if (!lastInbound) return true
    return Date.now() - new Date(lastInbound.timestamp).getTime() > WINDOW_MS
  }, [messages])

  const handleMessageSent = useCallback(() => {
    // Refetch imediato após envio para exibir a mensagem
    fetch(`/api/whatsapp/conversations/${conversationId}`)
      .then((r) => r.json())
      .then((data) => {
        const fresh: WaMessage[] = data.conversation?.messages ?? []
        setMessages(fresh)
        scrollToBottom()
      })
      .catch(() => {})
  }, [conversationId, scrollToBottom])

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Área de mensagens — scroll interno */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Sem mensagens ainda
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {windowExpired ? (
        <TemplateSelector conversationId={conversationId} onMessageSent={handleMessageSent} />
      ) : (
        <MessageInput conversationId={conversationId} onMessageSent={handleMessageSent} />
      )}
    </div>
  )
}
