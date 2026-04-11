'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Eraser, Trash2, Receipt, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConversationActionsModalProps {
  open:        boolean
  onClose:     () => void
  iaAtiva:     boolean
  togglingIa:  boolean
  onToggleIa:  () => void
  onOrcamento: () => void
  onClear:     () => void
  onDelete:    () => void
}

export function ConversationActionsModal({
  open,
  onClose,
  iaAtiva,
  togglingIa,
  onToggleIa,
  onOrcamento,
  onClear,
  onDelete,
}: ConversationActionsModalProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="conv-actions-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={onClose}
          />

          <motion.div
            key="conv-actions-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[61] rounded-t-2xl bg-background shadow-2xl overflow-hidden"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3">
              <p className="flex-1 text-base font-semibold">Ações</p>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="border-t" />

            {/* Actions */}
            <div className="py-2">
              {/* Toggle IA */}
              <button
                onClick={() => { onToggleIa(); onClose() }}
                disabled={togglingIa}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left disabled:opacity-40"
              >
                <div className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                  iaAtiva ? 'bg-emerald-500/10' : 'bg-muted'
                )}>
                  <Bot className={cn('w-4 h-4', iaAtiva ? 'text-emerald-600' : 'text-muted-foreground')} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {iaAtiva ? 'Desativar IA' : 'Ativar IA'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {iaAtiva ? 'Resposta automática ativa nesta conversa' : 'Ativar resposta automática com IA'}
                  </p>
                </div>
                <span className={cn(
                  'shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                  iaAtiva ? 'bg-emerald-500/15 text-emerald-700' : 'bg-muted text-muted-foreground'
                )}>
                  {iaAtiva ? 'ON' : 'OFF'}
                </span>
              </button>

              {/* Orçamento */}
              <button
                onClick={() => { onOrcamento(); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Criar orçamento</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Gerar mensagem de orçamento pronto</p>
                </div>
              </button>

              <div className="mx-4 border-t my-1" />

              {/* Limpar mensagens */}
              <button
                onClick={() => { onClear(); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-amber-500/5 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Eraser className="w-4 h-4 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-700">Limpar mensagens</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Apaga o histórico desta conversa</p>
                </div>
              </button>

              {/* Excluir conversa */}
              <button
                onClick={() => { onDelete(); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-red-500/5 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-red-600">Excluir conversa</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Remove a conversa e todas as mensagens</p>
                </div>
              </button>
            </div>

            <div className="h-4" />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
