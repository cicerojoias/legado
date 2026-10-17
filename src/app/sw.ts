import { defaultCache, PAGES_CACHE_NAME } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from "serwist";

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
  runtimeCaching: [
    // Mídias do WhatsApp NUNCA passam pelo cache do SW: o defaultCache tem uma regra
    // NetworkFirst para /api/ que serviria respostas completas cacheadas a requests
    // com Range — o iOS exige 206 para <video>/<audio> e renderiza player preto sem isso.
    // Além de encher o Cache Storage (quota apertada em PWA iOS) com binários de vários MB.
    {
      matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/api/whatsapp/media/"),
      handler: new NetworkOnly(),
    },
    // As regras de navegação do defaultCache (RSC prefetch, RSC e HTML) usam NetworkFirst
    // SEM networkTimeoutSeconds: numa rede instável, o SW espera a resposta de rede
    // indefinidamente e nunca cai pro fallback de cache — a tela de carregamento trava
    // pra sempre. Sobrescrevemos essas 3 entradas aqui (mesmos matchers/cacheNames do
    // pacote) só para adicionar timeout, antes do spread do defaultCache abaixo.
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.headers.get("RSC") === "1" &&
        request.headers.get("Next-Router-Prefetch") === "1" &&
        sameOrigin &&
        !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE_NAME.rscPrefetch,
        networkTimeoutSeconds: 10,
        plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.headers.get("RSC") === "1" && sameOrigin && !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE_NAME.rsc,
        networkTimeoutSeconds: 10,
        plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },
    {
      matcher: ({ request, url: { pathname }, sameOrigin }) =>
        request.headers.get("Content-Type")?.includes("text/html") && sameOrigin && !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: PAGES_CACHE_NAME.html,
        networkTimeoutSeconds: 10,
        plugins: [new ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 24 * 60 * 60 })],
      }),
    },
    ...defaultCache,
  ],
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

const MAX_STACKED_MESSAGES = 3

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

      // Acumula as mensagens da mesma conversa numa única notificação (estilo WhatsApp):
      // conversas diferentes ficam em notificações separadas (tag por conversa) e cada uma
      // mostra as últimas mensagens recebidas, não só a mais recente.
      const tag = `wab-${conversationPayload.conversationId}`
      let previousMessages: string[] = []
      try {
        const existing = await self.registration.getNotifications({ tag })
        for (const n of existing) {
          const stored = (n.data as { messages?: unknown } | null)?.messages
          if (Array.isArray(stored)) previousMessages = stored.filter((m): m is string => typeof m === 'string')
          else if (n.body) previousMessages = [n.body]
          n.close()
        }
      } catch {
        // getNotifications indisponível — segue mostrando só a mensagem atual
      }

      const messages = [...previousMessages, conversationPayload.body].slice(-MAX_STACKED_MESSAGES)
      const total = previousMessages.length + 1
      const title = total > 1
        ? `${conversationPayload.title} (${total} mensagens)`
        : conversationPayload.title

      await self.registration.showNotification(title, {
        body: messages.join('\n'),
        icon: conversationPayload.icon,
        badge: conversationPayload.badge,
        tag,
        renotify: true,
        data: {
          url: conversationPayload.url,
          conversationId: conversationPayload.conversationId,
          messages,
        },
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
