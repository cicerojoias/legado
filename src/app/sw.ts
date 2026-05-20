import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

// ─── Types ────────────────────────────────────────────────────────────────────

type PushPayload = {
  title: string
  body: string
  icon: string
  badge: string
  conversationId: string
  url: string
  unreadCount: number
}

type DailySummaryPayload = {
  title: string
  body: string
  icon: string
  badge: string
  type: 'daily-summary'
  url: string
  unreadCount: number
  data: {
    entradas: number
    saidas: number
    saldo: number
    pix: number
    debito: number
    credito: number
    especie: number
  }
}

// ─── Push handler ─────────────────────────────────────────────────────────────
// Runs in background (even with app closed).
// Handles both WAB conversation notifications and daily summary notifications.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload: PushPayload | DailySummaryPayload
  try {
    payload = event.data.json() as PushPayload | DailySummaryPayload
  } catch {
    return // malformed payload — ignore silently
  }

  event.waitUntil(
    (async () => {
      // Update app badge (feature-detect: not available in all browsers/OS)
      if ('setAppBadge' in self.navigator && payload.unreadCount > 0) {
        try {
          await (self.navigator as Navigator & { setAppBadge(n: number): Promise<void> }).setAppBadge(
            payload.unreadCount
          )
        } catch {
          // Badge API present but failed (e.g. permission revoked) — non-fatal
        }
      }

      // Check if this is a daily summary notification
      const isDailySummary = 'type' in payload && payload.type === 'daily-summary'

      if (isDailySummary) {
        // Always show daily summary notifications
        await self.registration.showNotification(payload.title, {
          body: payload.body,
          icon: payload.icon,
          badge: payload.badge,
          tag: 'daily-summary',
          renotify: true,
          data: { url: payload.url, type: 'daily-summary' },
        })
        return
      }

      // WAB conversation notification — suppress only if the exact conversation is visible
      const conversationPayload = payload as PushPayload
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const conversationVisible = windowClients.some(
        (c) =>
          (c as WindowClient).visibilityState === 'visible' &&
          c.url.includes(`/inbox/${conversationPayload.conversationId}`)
      )
      if (conversationVisible) return

      await self.registration.showNotification(conversationPayload.title, {
        body: conversationPayload.body,
        icon: conversationPayload.icon,
        badge: conversationPayload.badge,
        // tag: replaces previous notification for the same conversation
        tag: `wab-${conversationPayload.conversationId}`,
        renotify: true,
        data: { url: conversationPayload.url, conversationId: conversationPayload.conversationId },
      })
    })()
  )
})

// ─── Notification click handler ───────────────────────────────────────────────
// Focus existing inbox tab (and postMessage to navigate) or open new window.
// Does NOT clear badge here — badge is managed by push payload (unreadCount).

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url: string = (event.notification.data?.url as string | undefined) ?? '/inbox'

  event.waitUntil(
    (async () => {
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Procura qualquer aba aberta que pertença à mesma origem da aplicação
      const existingClient = windowClients.find((c) => {
        try {
          return new URL(c.url).origin === self.location.origin
        } catch {
          return false
        }
      })

      if (existingClient) {
        await (existingClient as WindowClient).focus()
        // Envia mensagem para que o PwaNavigationListener global no React redirecione a rota
        existingClient.postMessage({ type: 'NAVIGATE_TO', url })
      } else {
        await self.clients.openWindow(url)
      }
    })()
  )
})
