'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Renderiza null. Escuta mudanças em wa_conversations e INSERT em wa_messages
 * via Supabase Realtime.
 * 
 * ATUALIZAÇÃO EM TEMPO REAL SEM REFRESH:
 * - wa_conversations UPDATE: atualiza estado local da conversa
 * - wa_messages INSERT: notifica ChatWindow via CustomEvent
 * 
 * Montado no layout do inbox para cobrir tanto /inbox quanto /inbox/[id].
 */
export function ConversationListRealtimeSync() {
  const router = useRouter()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const [lastUpdate, setLastUpdate] = useState(0)

  useEffect(() => {
    const supabase = createClient()

    console.log('[wab-realtime-list] Iniciando sincronização em tempo real...')

    const channel = supabase
      .channel('wab-list-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_conversations' },
        (payload) => {
          console.log('[wab-realtime-list] wa_conversations UPDATE:', payload.new)
          // Dispara evento para atualizar lista de conversas
          window.dispatchEvent(new CustomEvent('wab-conversation-update', { 
            detail: payload.new 
          }))
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages' },
        (payload) => {
          console.log('[wab-realtime-list] Nova mensagem:', payload.new)
          // Dispara evento global - ChatWindow vai capturar
          window.dispatchEvent(new CustomEvent('wab-new-message', { 
            detail: payload.new 
          }))
          // Atualiza timestamp para forçar re-render da lista
          setLastUpdate(Date.now())
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[wab-realtime-list] ✅ Inscrito com sucesso no canal realtime')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[wab-realtime-list] ❌ Erro no canal:', err)
        } else if (status === 'TIMED_OUT') {
          console.error('[wab-realtime-list] ⏱️ Timeout ao subscrever')
        } else if (status === 'CLOSED') {
          console.warn('[wab-realtime-list] 🔌 Canal fechado')
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        console.log('[wab-realtime-list] Limpando canal...')
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [router])

  return null
}
