'use client'

import { useState, useEffect, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import * as motion from 'framer-motion/client'
import { X, ChevronLeft, ChevronRight, Zap, Tag, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveWelcomeSettings } from '../actions/settings'
import { useTemplates } from './useTemplates'
import type { WaTag, WaSettings } from '@prisma/client'

type Screen = 'root' | 'welcome'

interface WABSettingsModalProps {
  open:            boolean
  onClose:         () => void
  onOpenTemplates: () => void
  onOpenTags:      () => void
  tags:            WaTag[]
  initialSettings: WaSettings | null
}

export function WABSettingsModal({
  open,
  onClose,
  onOpenTemplates,
  onOpenTags,
  tags,
  initialSettings,
}: WABSettingsModalProps) {
  const [screen, setScreen] = useState<Screen>('root')
  const [mounted, setMounted] = useState(false)

  const [welcomeEnabled, setWelcomeEnabled] = useState(initialSettings?.welcome_enabled ?? false)
  const [welcomeMessage, setWelcomeMessage] = useState(initialSettings?.welcome_message ?? '')
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const { templates } = useTemplates()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => {
        setScreen('root')
        setSaveError('')
        setSaveSuccess(false)
      }, 300)
      return () => clearTimeout(id)
    }
  }, [open])

  useEffect(() => {
    setWelcomeEnabled(initialSettings?.welcome_enabled ?? false)
    setWelcomeMessage(initialSettings?.welcome_message ?? '')
  }, [initialSettings])

  function handleSaveWelcome() {
    setSaveError('')
    setSaveSuccess(false)
    startTransition(async () => {
      const result = await saveWelcomeSettings(welcomeEnabled, welcomeMessage)
      if (!result.success) {
        setSaveError(result.message ?? 'Erro ao salvar. Tente novamente.')
      } else {
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      }
    })
  }

  function handleToggleWelcome(val: boolean) {
    if (val && !welcomeMessage.trim()) return
    setWelcomeEnabled(val)
  }

  if (!mounted) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="wab-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={onClose}
          />

          {/* Bottom sheet */}
          <motion.div
            key="wab-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[61] flex flex-col rounded-t-2xl bg-background shadow-2xl overflow-hidden max-h-[92dvh]"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Screens container */}
            <div className="flex flex-1 min-h-0 overflow-hidden relative">

              {/* ── SCREEN ROOT ─────────────────────────────────────── */}
              <div className={cn(
                'absolute inset-0 flex flex-col transition-transform duration-300 ease-out',
                screen === 'root' ? 'translate-x-0' : '-translate-x-full'
              )}>
                <div className="flex items-center gap-2 px-4 py-3 shrink-0">
                  <div className="flex-1">
                    <h2 className="text-base font-semibold">Configurações</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="border-t shrink-0" />

                <div className="flex-1 overflow-y-auto min-h-0">
                  <p className="px-4 pt-4 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Automações
                  </p>
                  <button
                    onClick={() => setScreen('welcome')}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Mensagem de Boas-vindas</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {welcomeEnabled ? 'Ativa — enviada após 7 dias sem contato' : 'Inativa'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>

                  <p className="px-4 pt-4 pb-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Catálogos
                  </p>
                  <button
                    onClick={() => { onClose(); setTimeout(onOpenTemplates, 150) }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Mensagens Rápidas</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {templates.length} {templates.length === 1 ? 'mensagem' : 'mensagens'} configuradas
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                  <button
                    onClick={() => { onClose(); setTimeout(onOpenTags, 150) }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Tag className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">Tags</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {tags.length} {tags.length === 1 ? 'tag ativa' : 'tags ativas'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </div>
              </div>

              {/* ── SCREEN WELCOME ──────────────────────────────────── */}
              <div className={cn(
                'absolute inset-0 flex flex-col transition-transform duration-300 ease-out',
                screen === 'welcome' ? 'translate-x-0' : 'translate-x-full'
              )}>
                <div className="flex items-center gap-2 px-4 py-3 shrink-0">
                  <button
                    onClick={() => { setScreen('root'); setSaveError(''); setSaveSuccess(false) }}
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="flex-1">
                    <h2 className="text-base font-semibold">Mensagem de Boas-vindas</h2>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="border-t shrink-0" />

                <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">Ativar boas-vindas automática</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        Envia automaticamente quando um cliente manda mensagem após{' '}
                        <strong>7 dias</strong> sem contato de nenhum dos lados.
                      </p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={welcomeEnabled}
                      onClick={() => handleToggleWelcome(!welcomeEnabled)}
                      className={cn(
                        'relative shrink-0 w-12 h-6 rounded-full transition-colors duration-200',
                        welcomeEnabled ? 'bg-primary' : 'bg-muted-foreground/30',
                        !welcomeMessage.trim() && 'opacity-40 cursor-not-allowed'
                      )}
                    >
                      <span className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                        welcomeEnabled ? 'translate-x-6' : 'translate-x-0'
                      )} />
                    </button>
                  </div>

                  {!welcomeMessage.trim() && (
                    <p className="text-xs text-amber-600 -mt-2">
                      Preencha a mensagem abaixo para ativar o toggle.
                    </p>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Mensagem</label>
                    <textarea
                      value={welcomeMessage}
                      onChange={e => setWelcomeMessage(e.target.value)}
                      placeholder="Olá, seja bem-vindo(a) à *Cícero Joias*! ✨..."
                      maxLength={1000}
                      rows={7}
                      className="w-full rounded-xl border bg-muted/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground/60 leading-relaxed"
                    />
                    <p className="text-xs text-muted-foreground text-right">{welcomeMessage.length}/1000</p>
                  </div>

                  {saveError && <p className="text-sm text-destructive">{saveError}</p>}
                  {saveSuccess && <p className="text-sm text-green-600">Salvo com sucesso!</p>}
                </div>

                <div className="shrink-0 border-t px-4 py-3 bg-background">
                  <button
                    onClick={handleSaveWelcome}
                    disabled={isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
                  >
                    {isPending ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
