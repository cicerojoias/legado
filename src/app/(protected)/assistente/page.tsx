'use client'

import { useState, useCallback } from 'react'
import { Sparkles, Copy, Check, Loader2, RotateCcw } from 'lucide-react'

export default function AssistentePage() {
  const [draft, setDraft] = useState('')
  const [context, setContext] = useState('')
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const generate = useCallback(async () => {
    if (!draft.trim()) return
    setLoading(true)
    setError('')
    setResult('')

    try {
      const res = await fetch('/api/whatsapp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draft, context }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido')
      setResult(data.generated)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar resposta')
    } finally {
      setLoading(false)
    }
  }, [draft, context])

  const copy = useCallback(async () => {
    if (!result) return
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [result])

  const reset = useCallback(() => {
    setDraft('')
    setContext('')
    setResult('')
    setError('')
  }, [])

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <div>
          <h1 className="font-semibold text-lg leading-tight">Assistente IA</h1>
          <p className="text-xs text-muted-foreground">
            Transforme rascunhos em mensagens profissionais
          </p>
        </div>
      </div>

      {/* Contexto (opcional) */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="context">
          Contexto da conversa{' '}
          <span className="text-muted-foreground font-normal">(opcional)</span>
        </label>
        <textarea
          id="context"
          className="w-full min-h-[80px] rounded-xl border bg-muted/40 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Cole as últimas mensagens do cliente para dar contexto à IA..."
          value={context}
          onChange={(e) => setContext(e.target.value)}
        />
      </div>

      {/* Rascunho */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="draft">
          Sua mensagem / rascunho
        </label>
        <textarea
          id="draft"
          className="w-full min-h-[120px] rounded-xl border bg-muted/40 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Ex: 'o colar q a cliente pediu ta pronto, ela pode passar buscar'"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>

      {/* Botão gerar */}
      <button
        onClick={generate}
        disabled={!draft.trim() || loading}
        className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-medium transition-opacity disabled:opacity-50"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Gerando...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Transformar mensagem
          </>
        )}
      </button>

      {/* Erro */}
      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Mensagem gerada</span>
            <div className="flex gap-2">
              <button
                onClick={reset}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                Reiniciar
              </button>
              <button
                onClick={copy}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                {copied ? (
                  <><Check className="w-3 h-3" /> Copiado</>
                ) : (
                  <><Copy className="w-3 h-3" /> Copiar</>
                )}
              </button>
            </div>
          </div>
          <div className="rounded-xl border bg-card p-4 text-sm whitespace-pre-wrap leading-relaxed">
            {result}
          </div>
        </div>
      )}
    </div>
  )
}
