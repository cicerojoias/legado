'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Pencil, Trash2, ChevronLeft, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTemplates } from './useTemplates'
import { Template } from './templates'

interface TemplatesManagerModalProps {
  open: boolean
  onClose: () => void
}

type Mode = 'list' | 'edit'

const EMPTY_FORM: Template = { slug: '', label: '', content: '' }

export function TemplatesManagerModal({ open, onClose }: TemplatesManagerModalProps) {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<Mode>('list')
  const [editing, setEditing] = useState<Template>(EMPTY_FORM)
  const [originalSlug, setOriginalSlug] = useState<string | null>(null) // null = novo
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [mounted, setMounted] = useState(false)

  const { templates, addTemplate, updateTemplate, deleteTemplate } = useTemplates()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      // Reset ao fechar
      setTimeout(() => { setMode('list'); setEditing(EMPTY_FORM); setOriginalSlug(null); setError('') }, 300)
    }
  }, [open])

  function openAdd() {
    setEditing(EMPTY_FORM)
    setOriginalSlug(null)
    setError('')
    setMode('edit')
  }

  function openEdit(t: Template) {
    setEditing({ ...t })
    setOriginalSlug(t.slug)
    setError('')
    setMode('edit')
  }

  function handleSlugChange(raw: string) {
    // Lowercase, remove espaços, só alfanumérico e hífen
    const cleaned = raw.toLowerCase().replace(/[^a-z0-9\-]/g, '')
    setEditing(prev => ({ ...prev, slug: cleaned }))
  }

  function handleSave() {
    const { slug, label, content } = editing
    if (!slug.trim()) { setError('O atalho não pode estar vazio.'); return }
    if (!label.trim()) { setError('O nome não pode estar vazio.'); return }
    if (!content.trim()) { setError('O conteúdo não pode estar vazio.'); return }

    // Checar duplicata de slug (excluindo o próprio ao editar)
    const isDuplicate = templates.some(t => t.slug === slug && t.slug !== originalSlug)
    if (isDuplicate) { setError(`Já existe um template com o atalho /${slug}.`); return }

    const t: Template = { slug: slug.trim(), label: label.trim(), content: content.trim() }
    if (originalSlug === null) {
      addTemplate(t)
    } else {
      updateTemplate(originalSlug, t)
    }
    setMode('list')
  }

  function handleDelete(slug: string) {
    if (deleteConfirm === slug) {
      deleteTemplate(slug)
      setDeleteConfirm(null)
    } else {
      setDeleteConfirm(slug)
    }
  }

  if (!open && !visible) return null
  if (!mounted) return null

  return createPortal(
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
          'transition-transform duration-300 ease-out max-h-[92dvh]',
          visible ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 shrink-0">
          {mode === 'edit' && (
            <button
              onClick={() => { setMode('list'); setError('') }}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-base font-semibold">
              {mode === 'list' ? 'Mensagens Rápidas' : originalSlug === null ? 'Nova mensagem' : 'Editar mensagem'}
            </h2>
            {mode === 'list' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Digite <span className="font-mono">/</span> no chat para usar
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="border-t shrink-0" />

        {/* ── MODO LISTA ───────────────────────────────────────── */}
        {mode === 'list' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0">
              {templates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Zap className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Nenhuma mensagem rápida</p>
                </div>
              ) : (
                <div className="divide-y">
                  {templates.map((t) => (
                    <div key={t.slug} className="flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0">
                            /{t.slug}
                          </span>
                          <span className="text-sm font-medium truncate">{t.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {t.content}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-0.5">
                        <button
                          onClick={() => openEdit(t)}
                          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(t.slug)}
                          className={cn(
                            'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
                            deleteConfirm === t.slug
                              ? 'bg-destructive text-white'
                              : 'hover:bg-muted text-muted-foreground hover:text-destructive'
                          )}
                          title={deleteConfirm === t.slug ? 'Toque novamente para confirmar' : 'Excluir'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t px-4 py-3 bg-background">
              <button
                onClick={openAdd}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                <Plus className="w-4 h-4" />
                Nova mensagem
              </button>
            </div>
          </>
        )}

        {/* ── MODO EDIÇÃO ──────────────────────────────────────── */}
        {mode === 'edit' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-4">

              {/* Slug */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Atalho</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none font-mono">
                    /
                  </span>
                  <input
                    type="text"
                    value={editing.slug}
                    onChange={(e) => handleSlugChange(e.target.value)}
                    placeholder="boasvindas"
                    className="w-full rounded-xl border bg-muted/40 pl-7 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono placeholder:font-sans placeholder:text-muted-foreground/60"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Letras minúsculas, números e hífens.</p>
              </div>

              {/* Label */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome</label>
                <input
                  type="text"
                  value={editing.label}
                  onChange={(e) => setEditing(prev => ({ ...prev, label: e.target.value }))}
                  placeholder="Ex: Boas-vindas"
                  className="w-full rounded-xl border bg-muted/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                />
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Conteúdo</label>
                <textarea
                  value={editing.content}
                  onChange={(e) => setEditing(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Texto da mensagem..."
                  rows={7}
                  className="w-full rounded-xl border bg-muted/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none placeholder:text-muted-foreground/60 leading-relaxed"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <div className="shrink-0 border-t px-4 py-3 bg-background">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all"
              >
                Salvar
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  )
}
