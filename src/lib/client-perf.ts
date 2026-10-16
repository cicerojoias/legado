/**
 * Medições de latência percebida no browser (inbox WhatsApp).
 *
 * Cada medição vira uma linha `[perf]` no console e fica em `window.__wabPerf`.
 * No console do browser, `__wabPerfSummary()` mostra mediana/p90 por métrica.
 */

type PerfEntry = { label: string; ms: number; at: number; detail?: string }

declare global {
  interface Window {
    __wabPerf?: PerfEntry[]
    __wabPerfSummary?: () => void
  }
}

const pending = new Map<string, number>()

export function perfStart(key: string) {
  if (typeof performance === 'undefined') return
  pending.set(key, performance.now())
}

/** Encerra a medição após o próximo frame pintado (aproxima "visível na tela"). */
export function perfEnd(key: string, label: string, detail?: string) {
  const started = pending.get(key)
  if (started === undefined) return
  pending.delete(key)
  requestAnimationFrame(() => {
    setTimeout(() => record(label, performance.now() - started, detail), 0)
  })
}

/** Marco intermediário: registra o tempo decorrido sem encerrar a medição. */
export function perfMark(key: string, label: string) {
  const started = pending.get(key)
  if (started === undefined) return
  requestAnimationFrame(() => {
    setTimeout(() => record(label, performance.now() - started), 0)
  })
}

export function perfHas(key: string) {
  return pending.has(key)
}

function record(label: string, ms: number, detail?: string) {
  if (typeof window === 'undefined') return
  const list = (window.__wabPerf ??= [])
  list.push({ label, ms: Math.round(ms), at: Date.now(), detail })
  if (list.length > 200) list.shift()
  console.info(`[perf] ${label}: ${Math.round(ms)}ms${detail ? ` (${detail})` : ''}`)

  window.__wabPerfSummary ??= () => {
    const groups = new Map<string, number[]>()
    for (const e of window.__wabPerf ?? []) {
      groups.set(e.label, [...(groups.get(e.label) ?? []), e.ms])
    }
    const rows = [...groups].map(([metric, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      return {
        metric,
        n: sorted.length,
        mediana: sorted[Math.floor(sorted.length / 2)],
        p90: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))],
      }
    })
    console.table(rows)
  }
}
