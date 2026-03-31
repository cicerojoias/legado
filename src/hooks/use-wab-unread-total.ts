'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'

export function useWabUnreadTotal() {
  const [total, setTotal] = useState(0)
  const channelRef = useRef<RealtimeChannel | null>(null)

  const fetchTotal = () => {
    fetch('/api/whatsapp/unread-count')
      .then((r) => r.json())
      .then((data: { total: number }) => setTotal(data.total))
      .catch(() => {})
  }

  useEffect(() => {
    fetchTotal()

    const supabase = createClient()

    // RLS garante que só recebemos eventos das próprias rows (userId = auth.uid())
    const channel = supabase
      .channel('wab-unread-total')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wa_conversation_reads' },
        fetchTotal
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [])

  return total
}
