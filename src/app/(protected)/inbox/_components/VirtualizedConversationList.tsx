'use client'

import { useEffect, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ConversationItem } from './ConversationItem'
import type { ConversationWithPreview } from './types'

interface VirtualizedConversationListProps {
  conversations: ConversationWithPreview[]
  activeId?: string
}

/**
 * Renderiza lista de conversas com virtualização via @tanstack/react-virtual.
 * Usa o scroll container do pai (ConversationSidebar) identificado pelo ID
 * "conversation-list-scroll" — não cria scroll próprio.
 */
export function VirtualizedConversationList({ conversations, activeId }: VirtualizedConversationListProps) {
  const getScrollElement = useCallback(
    () => document.getElementById('conversation-list-scroll'),
    []
  )

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement,
    estimateSize: () => 72, // altura estimada de cada ConversationItem (~72px)
    overscan: 5,            // renderiza 5 itens extras acima/abaixo do viewport
  })

  // Scrolla para o item ativo quando activeId muda
  useEffect(() => {
    if (!activeId) return
    const idx = conversations.findIndex((c) => c.id === activeId)
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: 'center' })
    }
  }, [activeId]) // eslint-disable-line react-hooks/exhaustive-deps

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
            const conv = conversations[virtualItem.index]
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
