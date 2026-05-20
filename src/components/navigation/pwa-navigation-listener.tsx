'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Escuta mensagens do Service Worker (ex: evento 'NAVIGATE_TO' disparado após clique em push)
 * e realiza a navegação SPA suave no Next.js.
 * Montado globalmente no ProtectedLayout.
 */
export function PwaNavigationListener() {
  const router = useRouter()

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handler = (event: MessageEvent<{ type?: string; url?: string }>) => {
      if (event.data?.type === 'NAVIGATE_TO' && typeof event.data.url === 'string') {
        console.log('[PwaNavigationListener] Recebida rota para navegação:', event.data.url)
        router.push(event.data.url)
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [router])

  return null
}
