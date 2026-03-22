'use client'

import { useEffect } from 'react'

/**
 * Layout exclusivo da conversa: desativa o overflow-y do <main> (definido
 * no layout protegido) para que o chat gerencie seu próprio scroll interno.
 * Restaura o overflow original ao desmontar (navegar para outra rota).
 */
export default function ConversationLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return
    const prev = main.style.overflowY
    main.style.overflowY = 'hidden'
    return () => {
      main.style.overflowY = prev
    }
  }, [])

  return <>{children}</>
}
