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

// ─── Push handler ─────────────────────────────────────────────────────────────
// Runs in background (even with app closed).
// Suppresses notification only when the target conversation is visibly open.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
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

      // Suppress notification only if the exact conversation tab is visible.
      // Minimized / backgrounded windows must still receive the notification.
      const windowClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      const conversationVisible = windowClients.some(
        (c) =>
          (c as WindowClient).visibilityState === 'visible' &&
          c.url.includes(`/inbox/${payload.conversationId}`)
      )
      if (conversationVisible) return

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: payload.icon,
        badge: payload.badge,
        // tag: replaces previous notification for the same conversation
        tag: `wab-${payload.conversationId}`,
        renotify: true,
        data: { url: payload.url, conversationId: payload.conversationId },
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

      const existingInbox = windowClients.find((c) => c.url.includes('/inbox'))

      if (existingInbox) {
        await (existingInbox as WindowClient).focus()
        // Tells ChatWindow / inbox router to navigate to the right conversation
        existingInbox.postMessage({ type: 'NAVIGATE_TO', url })
      } else {
        await self.clients.openWindow(url)
      }
    })()
  )
})
