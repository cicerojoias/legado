'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Check, Edit, X, Loader2, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AssistenteModalProps {
  open: boolean
  onClose: () => void
  onAccept: (text: string) => void
  conversationContext?: string
}

type ModalState = 'input' | 'generating' | 'result' | 'editing'

export function AssistenteModal({ open, onClose, onAccept, conversationContext }: AssistenteModalProps) {
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<ModalState>('input')
  
  // Input do usuário
  const [prompt, setPrompt] = useState('')
  
  // Resultado gerado
  const [generated, setGenerated] = useState('')
  const [error, setError] = useState('')

  // Animação de entrada/saída
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [open])

  // Reset quando modal fecha
  useEffect(() => {
    if (!open) {
      setState('input')
      setPrompt('')
      setGenerated('')
      setError('')
    }
  }, [open])

  const canGenerate = prompt.trim().length >= 2

  async function handleGenerate() {
    if (!canGenerate) return
    
    setState('generating')
    setError('')
    
    try {
      const res = await fetch('/api/whatsapp/generate-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          conversationContext: conversationContext || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro desconhecido')
      
      setGenerated(data.generated)
      setState('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao gerar mensagem')
      setState('input')
    }
  }

  function handleAccept() {
    if (!generated) return
    onAccept(generated)
    onClose()
  }

  function handleEdit() {
    setState('editing')
  }

  function handleSaveEdit() {
    if (!prompt.trim()) return
    // Re-gerar com o prompt editado
    handleGenerate()
  }

  function handleReject() {
    setPrompt('')
    setGenerated('')
    setError('')
    setState('input')
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      if (state === 'input' && canGenerate) {
        handleGenerate()
      } else if (state === 'editing') {
        handleSaveEdit()
      }
    }
  }

  if (!open && !visible) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[61] flex flex-col rounded-t-2xl bg-background shadow-2xl',
          'transition-transform duration-300 ease-out max-h-[85dvh]',
          visible ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className={cn(
              'w-5 h-5 transition-colors',
              state === 'result' ? 'text-emerald-500' : 'text-primary'
            )} />
            <div>
              <h2 className="text-base font-semibold">
                {state === 'result' ? 'Mensagem Gerada' : 
                 state === 'editing' ? 'Editar Prompt' :
                 'Assistente IA'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {state === 'result' ? 'Escolha uma ação abaixo' :
                 state === 'editing' ? 'Ajuste e gere novamente' :
                 'Descreva o que deseja enviar'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-t shrink-0" />

        {/* Corpo com scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          
          {/* Estado: Input ou Editing */}
          {(state === 'input' || state === 'editing') && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {state === 'editing' ? 'Novo prompt' : 'O que deseja enviar?'}
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    state === 'editing'
                      ? 'Ajuste seu prompt e pressione Ctrl+Enter para gerar...'
                      : 'Ex: "Confirmar agendamento para amanhã às 14h" ou "Pedir para cliente enviar foto da peça"'
                  }
                  className="w-full min-h-[120px] rounded-xl border bg-muted/40 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground/60"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {conversationContext 
                    ? '✨ Contexto da conversa incluído automaticamente'
                    : 'Dica: seja específico para melhores resultados'}
                </p>
              </div>

              {state === 'editing' && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-2.5">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    💡 Ajuste o prompt e clique em "Gerar Novamente" para criar uma nova versão
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Estado: Gerando */}
          {state === 'generating' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Gerando mensagem com IA...</p>
            </div>
          )}

          {/* Estado: Resultado */}
          {state === 'result' && generated && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Mensagem pronta para envio</label>
                <div className="rounded-xl bg-primary/5 border border-primary/15 px-4 py-3">
                  <pre className="text-sm leading-relaxed whitespace-pre-wrap break-words font-sans text-foreground/80">
                    {generated}
                  </pre>
                </div>
              </div>

              {/* Prompt original (colapsado) */}
              <details className="group">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                  Ver prompt original
                </summary>
                <div className="mt-2 rounded-xl bg-muted/30 border border-border px-3 py-2">
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{prompt}</p>
                </div>
              </details>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t px-4 py-3 bg-background safe-area-bottom">
          {state === 'input' && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={cn(
                'w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-all duration-150',
                canGenerate
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
              )}
            >
              <Sparkles className="w-4 h-4" />
              Gerar Mensagem
            </button>
          )}

          {state === 'editing' && (
            <div className="flex gap-2">
              <button
                onClick={() => setState('input')}
                className="flex-1 flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold border border-border hover:bg-muted transition-all"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={!canGenerate}
                className={cn(
                  'flex-1 flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-all duration-150',
                  canGenerate
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
                )}
              >
                <Sparkles className="w-4 h-4" />
                Gerar Novamente
              </button>
            </div>
          )}

          {state === 'result' && (
            <div className="space-y-2">
              <button
                onClick={handleAccept}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600 active:scale-[0.98] transition-all"
              >
                <Check className="w-4 h-4" />
                Aceitar e Inserir no Chat
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium border border-border hover:bg-muted transition-all"
                >
                  <Edit className="w-4 h-4" />
                  Editar Prompt
                </button>
                <button
                  onClick={handleReject}
                  className="flex-1 flex items-center justify-center gap-2 rounded-full py-3 text-sm font-medium border border-border hover:bg-muted transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                  Nova Mensagem
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
