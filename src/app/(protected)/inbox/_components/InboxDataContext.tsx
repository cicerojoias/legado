'use client'

import { createContext, useContext } from 'react'
import type { WaTag } from '@prisma/client'

/**
 * Dados do inbox carregados uma única vez no layout (persistem entre conversas).
 * Evita que cada abertura de chat refaça auth + role + tags no servidor.
 */
interface InboxData {
  userId: string
  role:   string | null
  tags:   WaTag[]
}

const InboxDataContext = createContext<InboxData>({ userId: '', role: null, tags: [] })

export function InboxDataProvider({ value, children }: { value: InboxData; children: React.ReactNode }) {
  return <InboxDataContext.Provider value={value}>{children}</InboxDataContext.Provider>
}

export function useInboxData() {
  return useContext(InboxDataContext)
}
