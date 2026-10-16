'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { perfEnd } from '@/lib/client-perf'

/**
 * Estrutura persistente do inbox: lista à esquerda + conversa à direita.
 *
 * A lista vive no layout, então trocar de conversa ou voltar não refaz a busca
 * no servidor. No mobile, ao abrir um chat a lista fica invisível (não desmontada)
 * para preservar estado e posição de rolagem — voltar é instantâneo.
 */
export function InboxShell({ sidebar, children }: { sidebar: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname()
  const inChat = pathname.startsWith('/inbox/')

  useEffect(() => {
    if (!inChat) perfEnd('chat-back', 'voltar (clique → lista)')
  }, [inChat])

  return (
    <div className="relative flex h-full">
      <div
        className={cn(
          'flex h-full w-full md:w-auto',
          inChat && 'max-md:absolute max-md:inset-0 max-md:invisible max-md:pointer-events-none'
        )}
      >
        {sidebar}
      </div>

      <div className={cn('flex-1 min-w-0 h-full flex-col', inChat ? 'flex' : 'hidden md:flex')}>
        {children}
      </div>
    </div>
  )
}
