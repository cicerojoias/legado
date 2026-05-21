'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Componente global que sincroniza o estado do WhatsApp em tempo real.
 * Escuta todas as modificações no Supabase Realtime e as distribui via CustomEvents
 * no objeto `window` para que os componentes visuais (Sidebar, ChatWindow)
 * reajam instantaneamente sem precisar criar múltiplas conexões Websocket.
 */
export function ConversationListRealtimeSync() {
  useEffect(() => {
    const supabase = createClient()

    console.log('[wab-realtime-list] Iniciando sincronização em tempo real centralizada...')

    const channel = supabase
      .channel('wab-list-sync')
      // 1. Atualizações no cabeçalho/status das conversas (para a barra lateral)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_conversations' },
        (payload) => {
          console.log('[wab-realtime-list] wa_conversations UPDATE:', payload.new)
          window.dispatchEvent(
            new CustomEvent('wab-conversation-update', {
              detail: payload.new,
            })
          )
        }
      )
      // 2. Novas mensagens recebidas (para o ChatWindow e previews)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wa_messages' },
        (payload) => {
          console.log('[wab-realtime-list] Nova mensagem (INSERT):', payload.new)
          window.dispatchEvent(
            new CustomEvent('wab-new-message', {
              detail: payload.new,
            })
          )
        }
      )
      // 3. Status da mensagem atualizado (sent -> delivered -> read, reações, deleções)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'wa_messages' },
        (payload) => {
          console.log('[wab-realtime-list] Mensagem atualizada (UPDATE):', payload.new)
          window.dispatchEvent(
            new CustomEvent('wab-message-update', {
              detail: payload.new,
            })
          )
        }
      )
      // 4. Status de leitura e contadores de não lidas modificados
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wa_conversation_reads' },
        (payload) => {
          console.log('[wab-realtime-list] wa_conversation_reads update:', payload.new)
          window.dispatchEvent(
            new CustomEvent('wab-conversation-read-update', {
              detail: payload.new,
            })
          )
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[wab-realtime-list] ✅ Inscrito com sucesso no canal realtime global')
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[wab-realtime-list] ❌ Erro no canal realtime:', err)
        } else if (status === 'TIMED_OUT') {
          console.error('[wab-realtime-list] ⏱️ Timeout ao subscrever no canal realtime')
        } else if (status === 'CLOSED') {
          console.warn('[wab-realtime-list] 🔌 Canal realtime fechado')
        }
      })

    return () => {
      console.log('[wab-realtime-list] Limpando canal realtime global...')
      supabase.removeChannel(channel)
    }
  }, [])

  return null
}
