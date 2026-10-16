/**
 * Instrumentação leve de latência no servidor.
 *
 * - Route handlers: anexe `timing.header()` como `Server-Timing` (aparece na aba Timing do DevTools).
 * - Server components: `timing.log()` grava uma linha `[perf]` nos logs da Vercel.
 */
export function createServerTiming(name: string) {
  const start = performance.now()
  const entries: { label: string; dur: number }[] = []

  return {
    async measure<T>(label: string, work: PromiseLike<T> | (() => PromiseLike<T>)): Promise<T> {
      const s = performance.now()
      try {
        return await (typeof work === 'function' ? work() : work)
      } finally {
        entries.push({ label, dur: performance.now() - s })
      }
    },

    total() {
      return performance.now() - start
    },

    header() {
      return [...entries, { label: 'total', dur: performance.now() - start }]
        .map((e) => `${e.label};dur=${e.dur.toFixed(1)}`)
        .join(', ')
    },

    log() {
      const parts = entries.map((e) => `${e.label}=${e.dur.toFixed(0)}ms`).join(' ')
      console.info(`[perf] ${name} total=${(performance.now() - start).toFixed(0)}ms ${parts}`)
    },
  }
}
