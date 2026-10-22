'use client'

import { useEffect, useState } from 'react'

/**
 * Total de conversas não lidas do WhatsApp, em tempo real.
 * Só roda para quem vê o inbox (`ativo`). O cliente Supabase é carregado sob demanda,
 * depois da tela pronta, para não pesar em todas as telas (P1).
 */
export function useWabUnreadTotal(ativo: boolean) {
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (!ativo) return
    let cancelado = false
    let limpar: (() => void) | undefined

    const fetchTotal = () => {
      fetch('/api/whatsapp/unread-count')
        .then((r) => r.json())
        .then((data: { total: number }) => { if (!cancelado) setTotal(data.total) })
        .catch(() => {})
    }

    fetchTotal()

    import('@/lib/supabase/client').then(({ createClient }) => {
      if (cancelado) return
      const supabase = createClient()
      // RLS garante que só recebemos eventos das próprias rows (userId = auth.uid())
      const channel = supabase
        .channel('wab-unread-total')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversation_reads' }, fetchTotal)
        .subscribe()
      limpar = () => { supabase.removeChannel(channel) }
    })

    return () => {
      cancelado = true
      limpar?.()
    }
  }, [ativo])

  return total
}
