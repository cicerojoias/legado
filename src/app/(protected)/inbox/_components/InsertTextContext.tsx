'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface InsertTextContextValue {
  pendingText: string | null
  requestInsert: (text: string) => void
  clearPendingText: () => void
}

const InsertTextContext = createContext<InsertTextContextValue>({
  pendingText: null,
  requestInsert: () => {},
  clearPendingText: () => {},
})

export function InsertTextProvider({ children }: { children: React.ReactNode }) {
  const [pendingText, setPendingText] = useState<string | null>(null)
  const requestInsert = useCallback((text: string) => setPendingText(text), [])
  const clearPendingText = useCallback(() => setPendingText(null), [])

  return (
    <InsertTextContext.Provider value={{ pendingText, requestInsert, clearPendingText }}>
      {children}
    </InsertTextContext.Provider>
  )
}

export const useInsertText = () => useContext(InsertTextContext)
