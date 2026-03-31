'use client'

import { useEffect } from 'react'

/**
 * Layout da conversa individual.
 *
 * Combina duas estratégias:
 * 1. CSS wrapper com altura explícita → sem flash no render inicial do chat
 * 2. useEffect → remove pb-16 e overflow-y-auto do <main> para:
 *    - eliminar o espaço vazio de 64px abaixo do input
 *    - impedir que a página inteira scrole (header sumindo)
 */
export default function ConversationLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const main = document.querySelector('main')
    if (!main) return

    const prevOverflow = main.style.overflowY
    const prevPadding = main.style.paddingBottom

    main.style.overflowY = 'hidden'
    main.style.paddingBottom = '0'

    return () => {
      main.style.overflowY = prevOverflow
      main.style.paddingBottom = prevPadding
    }
  }, [])

  return (
    <div className="h-[calc(100dvh-4rem)] md:h-full overflow-hidden flex flex-col">
      {children}
    </div>
  )
}
