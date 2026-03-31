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

    const channel = supabase
      .channel('wab-list-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wa_conversations' },
        () => { router.refresh() }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages' },
        () => { router.refresh() }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [router])

  return null
}
