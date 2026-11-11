'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'

// ── Snapshot mínimo de uma mensagem para seleção ────────────────────────────
export interface MsgSnapshot {
  id: string
  content: string | null
  type: string
  direction: string
  timestamp: Date | string
  wa_message_id: string | null
}

// ── State context ─────────────────────────────────────────────────────────────
interface SelectionState {
  active: boolean
  selected: Map<string, MsgSnapshot>
  count: number
}

// ── Actions context ───────────────────────────────────────────────────────────
interface SelectionActions {
  enter: (msg: MsgSnapshot) => void   // entra no modo seleção com a primeira msg
  toggle: (msg: MsgSnapshot) => void  // liga/desliga seleção de uma msg
  clear: () => void                   // sai do modo seleção
}

const SelectionStateCtx = createContext<SelectionState>({
  active: false,
  selected: new Map(),
  count: 0,
})

const SelectionActionsCtx = createContext<SelectionActions>({
  enter: () => {},
  toggle: () => {},
  clear: () => {},
})

// ── Provider ──────────────────────────────────────────────────────────────────
export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<Map<string, MsgSnapshot>>(new Map())

  const active = selected.size > 0

  const state = useMemo<SelectionState>(
    () => ({ active, selected, count: selected.size }),
    [active, selected]
  )

  // ── Stable refs ──────────────────────────────────────────────────────────
  const setSelectedRef = useRef(setSelected)
  useEffect(() => { setSelectedRef.current = setSelected }, [])

  // Rastreia se fizemos pushState — necessário para consumir a entrada ao sair programaticamente
  const historyPushedRef = useRef(false)

  const actions = useMemo<SelectionActions>(() => ({
    enter: (msg) => {
      setSelectedRef.current(new Map([[msg.id, msg]]))
      window.history.pushState({ selectionMode: true }, '')
      historyPushedRef.current = true
    },
    toggle: (msg) => {
      setSelectedRef.current(prev => {
        const next = new Map(prev)
        if (next.has(msg.id)) {
          next.delete(msg.id)
        } else {
          next.set(msg.id, msg)
        }
        // Ao esvaziar manualmente, consome a entrada de histórico para que
        // o botão voltar não navegue para fora da conversa
        if (next.size === 0 && historyPushedRef.current) {
          historyPushedRef.current = false
          setTimeout(() => window.history.back(), 0)
        }
        return next
      })
    },
    clear: () => {
      setSelectedRef.current(new Map())
      if (historyPushedRef.current) {
        historyPushedRef.current = false
        setTimeout(() => window.history.back(), 0)
      }
    },
  }), []) // estável — nunca muda

  // ── Popstate: botão voltar do Android sai do modo seleção sem navegar ──────
  // Usa functional update para evitar re-render caso o estado já esteja vazio
  // (pode ocorrer se clear() disparou history.back() e o popstate chega depois)
  useEffect(() => {
    if (!active) return
    const handler = () => {
      historyPushedRef.current = false
      setSelected(prev => (prev.size === 0 ? prev : new Map()))
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [active])

  return (
    <SelectionStateCtx.Provider value={state}>
      <SelectionActionsCtx.Provider value={actions}>
        {children}
      </SelectionActionsCtx.Provider>
    </SelectionStateCtx.Provider>
  )
}

// ── Hooks públicos ────────────────────────────────────────────────────────────
export const useSelectionState = () => useContext(SelectionStateCtx)
export const useSelectionActions = () => useContext(SelectionActionsCtx)
