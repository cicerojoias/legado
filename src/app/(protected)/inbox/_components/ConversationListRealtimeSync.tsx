'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Renderiza null. Escuta mudanças em wa_conversations e INSERT em wa_messages
 * via Supabase Realtime e chama router.refresh() para re-render do servidor.
 * Montado no layout do inbox para cobrir tanto /inbox quanto /inbox/[id].
 */
export function ConversationListRealtimeSync() {
  const router = useRouter()
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()

    console.log('[wab-realtime-list] Iniciando sincronização em tempo real...')

    const channel = supabase
      .channel('wab-list-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wa_conversations' },
        (payload) => {
          console.log('[wab-realtime-list] wa_conversations changed:', payload.eventType, payload.new)
          router.refresh()
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages' },
        (payload) => {
          console.log('[wab-realtime-list] Nova mensagem recebida:', payload.new)
          router.refresh()
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
        } else {
          console.log('[wab-realtime-list] Status:', status)
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
