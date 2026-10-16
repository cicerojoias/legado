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
  isIOS: boolean
  requiresHomeScreen: boolean
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
    isIOS: false,
    requiresHomeScreen: false,
  })

  useEffect(() => {
    const isIOS =
      /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
    const requiresHomeScreen = isIOS && !isStandalone
    const hasPushApis =
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window

    if (!hasPushApis || requiresHomeScreen) {
      setState({
        supported: false,
        permission: 'Notification' in window ? Notification.permission : 'default',
        subscribed: false,
        isLoading: false,
        isIOS,
        requiresHomeScreen,
      })
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
          isIOS,
          requiresHomeScreen: false,
        })
      })
      .catch(() => {
        setState({
          supported: true,
          permission: Notification.permission,
          subscribed: false,
          isLoading: false,
          isIOS,
          requiresHomeScreen: false,
        })
      })
  }, [])

  const subscribe = useCallback(async (): Promise<boolean> => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY não configurada')
      return false
    }

    setState((current) => ({ ...current, isLoading: true }))

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState((current) => ({ ...current, permission, isLoading: false }))
        return false
      }

      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
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
        await subscription.unsubscribe().catch(() => {})
        setState((current) => ({ ...current, isLoading: false }))
        return false
      }

      setState((current) => ({
        ...current,
        permission: 'granted',
        subscribed: true,
        isLoading: false,
      }))
      return true
    } catch (err) {
      console.error('[push] subscribe error:', err)
      setState((current) => ({ ...current, isLoading: false }))
      return false
    }
  }, [])

  const unsubscribe = useCallback(async (): Promise<void> => {
    setState((current) => ({ ...current, isLoading: true }))

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

      setState((current) => ({ ...current, subscribed: false, isLoading: false }))
    } catch (err) {
      console.error('[push] unsubscribe error:', err)
      setState((current) => ({ ...current, isLoading: false }))
    }
  }, [])

  const sendTestNotification = useCallback(async (testType: 'whatsapp' | 'resumo'): Promise<boolean> => {
    try {
      const reg = await navigator.serviceWorker.ready
      const subscription = await reg.pushManager.getSubscription()
      if (!subscription) return false

      const json = subscription.toJSON() as {
        endpoint: string
        keys: { p256dh: string; auth: string }
      }
      const response = await fetch('/api/whatsapp/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...json, ...json.keys, testType }),
      })
      return response.ok
    } catch (err) {
      console.error('[push] test notification error:', err)
      return false
    }
  }, [])

  return { ...state, subscribe, unsubscribe, sendTestNotification }
}
