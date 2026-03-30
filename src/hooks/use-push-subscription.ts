'use client'

import { useState, useEffect, useCallback } from 'react'

// Converte VAPID public key de base64url para Uint8Array.
// String pura falha no Firefox e Safari — Uint8Array é o formato correto para todos os browsers.
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

type PushState = {
  supported: boolean
  permission: NotificationPermission
  subscribed: boolean
  isLoading: boolean
}

/**
 * Gerencia o ciclo de vida da Web Push subscription para notificações WAB.
 *
 * Retorna estado atual + funções `subscribe()` e `unsubscribe()` para uso no UI.
 * Não solicita permissão automaticamente — o usuário deve chamar `subscribe()` explicitamente.
 */
export function usePushSubscription() {
  const [state, setState] = useState<PushState>({
    supported: false,
    permission: 'default',
    subscribed: false,
    isLoading: true,
  })

  // Verifica suporte e subscription existente ao montar
  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!isSupported) {
      setState({ supported: false, permission: 'default', subscribed: false, isLoading: false })
      return
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((existing) => {
        setState({
          supported: true,
          permission: Notification.permission,
          subscribed: existing !== null,
          isLoading: false,
        })
      })
      .catch(() => {
        setState({
          supported: true,
          permission: Notification.permission,
          subscribed: false,
          isLoading: false,
        })
      })
  }, [])

  /**
   * Solicita permissão, cria a PushSubscription e registra no servidor.
   * @returns true se subscrito com sucesso, false caso contrário.
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada')
      return false
    }

    setState((s) => ({ ...s, isLoading: true }))

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState((s) => ({ ...s, permission, isLoading: false }))
        return false
      }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Cast necessário: TypeScript strict tipifica Uint8Array<ArrayBufferLike> mas
        // PushSubscriptionOptionsInit espera ArrayBuffer — o valor em runtime é correto.
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })

      const json = subscription.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }

      const res = await fetch('/api/whatsapp/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        }),
      })

      if (!res.ok) {
        // Rollback: remove subscription local se o servidor rejeitou
        await subscription.unsubscribe().catch(() => {})
        setState((s) => ({ ...s, isLoading: false }))
        return false
      }

      setState({ supported: true, permission: 'granted', subscribed: true, isLoading: false })
      return true
    } catch (err) {
      console.error('[push] subscribe error:', err)
      setState((s) => ({ ...s, isLoading: false }))
      return false
    }
  }, [])

  /**
   * Remove a subscription local e notifica o servidor para deletar do banco.
   */
  const unsubscribe = useCallback(async (): Promise<void> => {
    setState((s) => ({ ...s, isLoading: true }))

    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()

      if (subscription) {
        await fetch('/api/whatsapp/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }

      setState((s) => ({ ...s, subscribed: false, isLoading: false }))
    } catch (err) {
      console.error('[push] unsubscribe error:', err)
      setState((s) => ({ ...s, isLoading: false }))
    }
  }, [])

  return { ...state, subscribe, unsubscribe }
}
