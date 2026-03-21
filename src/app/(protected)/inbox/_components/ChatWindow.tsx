'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { WaMessage } from '@prisma/client'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'

interface ChatWindowProps {
  conversationId: string
  initialMessages: WaMessage[]
}

export function ChatWindow({ conversationId, initialMessages }: ChatWindowProps) {
  const [messages, setMessages] = useState<WaMessage[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
  }, [])

  // Scroll inicial instantâneo
  useEffect(() => {
    scrollToBottom(false)
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
          if (fresh.length === prev.length) return prev
          scrollToBottom()
          return fresh
        })
      } catch {
        // Silenciar erros de rede durante polling
      }
    }

    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [conversationId, scrollToBottom])

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
    <div className="flex flex-col h-full">
      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Sem mensagens ainda
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input fixo no fundo */}
      <MessageInput conversationId={conversationId} onMessageSent={handleMessageSent} />
    </div>
  )
}
