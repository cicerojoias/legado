'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { parseMessageTimestamp } from '@/lib/utils'

// Colunas `timestamp` (sem fuso) chegam do realtime como "2026-10-17T01:59:30.444", sem o "Z".
// O browser interpretaria como horário local (+3h no Brasil); normalizamos para ISO UTC
// antes de distribuir, igual ao formato que as APIs (Prisma/JSON) já entregam.
const NAIVE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?$/

function normalizeTimestamps<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row }
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === 'string' && NAIVE_TIMESTAMP.test(value)) {
      out[key] = parseMessageTimestamp(value).toISOString()
    }
  }
  return out as T
}

/**
 * Componente global que sincroniza o estado do WhatsApp em tempo real.
 * Escuta todas as modificações no Supabase Realtime e as distribui via CustomEvents
 * no objeto `window` para que os componentes visuais (Sidebar, ChatWindow)
 * reajam instantaneamente sem precisar criar múltiplas conexões Websocket.
 */
export function ConversationListRealtimeSync() {
  useEffect(() => {
    const supabase = createClient()


    const channel = supabase
      .channel('wab-list-sync')
      // 1. Atualizações no cabeçalho/status das conversas (para a barra lateral)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_conversations' },
        (payload) => {
          window.dispatchEvent(
            new CustomEvent('wab-conversation-update', {
              detail: normalizeTimestamps(payload.new),
            })
          )
        }
      )
      // 2. Novas mensagens recebidas (para o ChatWindow e previews)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages' },
        (payload) => {
          window.dispatchEvent(
            new CustomEvent('wab-new-message', {
              detail: normalizeTimestamps(payload.new),
            })
          )
        }
      )
      // 3. Status da mensagem atualizado (sent -> delivered -> read, reações, deleções)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_messages' },
        (payload) => {
          window.dispatchEvent(
            new CustomEvent('wab-message-update', {
              detail: normalizeTimestamps(payload.new),
            })
          )
        }
      )
      // 4. Status de leitura e contadores de não lidas modificados
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wa_conversation_reads' },
        (payload) => {
          window.dispatchEvent(
            new CustomEvent('wab-conversation-read-update', {
              detail: normalizeTimestamps(payload.new),
            })
          )
        }
      )
      .subscribe((status, err) => {
        // Só falhas aparecem no console; CLOSED é o fluxo normal ao desmontar
        if (status === 'CHANNEL_ERROR') {
          console.error('[wab-realtime-list] Erro no canal realtime:', err)
        } else if (status === 'TIMED_OUT') {
          console.error('[wab-realtime-list] Timeout ao subscrever no canal realtime')
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return null
}
