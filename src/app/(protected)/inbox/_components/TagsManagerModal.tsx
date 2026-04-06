'use client'

import { useState, useEffect, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Pencil, Trash2, ChevronLeft, Tag, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createTag, updateTag, deleteTag } from '../actions/tag-catalog'
import { TAG_COLORS } from '../actions/tag-constants'
import type { WaTag } from '@prisma/client'
import type { TagColor } from '../actions/tag-constants'

// Classes literais para o compilador do Tailwind v4 não purgar
const TAG_DOT_CLASSES: Record<string, string> = {
  amber:  'bg-amber-400',
  rose:   'bg-rose-400',
  sky:    'bg-sky-400',
  violet: 'bg-violet-400',
  orange: 'bg-orange-400',
  teal:   'bg-teal-400',
  pink:   'bg-pink-400',
  indigo: 'bg-indigo-400',
  lime:   'bg-lime-400',
  cyan:   'bg-cyan-400',
}

const TAG_COLOR_CLASSES: Record<string, { bg: string; text: string }> = {
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800'  },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-800'   },
  sky:    { bg: 'bg-sky-100',    text: 'text-sky-800'    },
  violet: { bg: 'bg-violet-100', text: 'text-violet-800' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-800'   },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-800'   },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800' },
  lime:   { bg: 'bg-lime-100',   text: 'text-lime-800'   },
  cyan:   { bg: 'bg-cyan-100',   text: 'text-cyan-800'   },
}

interface TagsManagerModalProps {
  open:         boolean
  onClose:      () => void
  initialTags:  WaTag[]
}

type Mode = 'list' | 'edit'

interface EditingTag {
  id?:   string
  name:  string
  color: TagColor
}

const EMPTY_FORM: EditingTag = { name: '', color: 'amber' }

export function TagsManagerModal({ open, onClose, initialTags }: TagsManagerModalProps) {
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<Mode>('list')
  const [tags, setTags] = useState<WaTag[]>(initialTags)
  const [editing, setEditing] = useState<EditingTag>(EMPTY_FORM)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Sincronizar quando initialTags mudar (revalidatePath propaga novos dados)
  useEffect(() => { setTags(initialTags) }, [initialTags])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
      setTimeout(() => {
        setMode('list')
        setEditing(EMPTY_FORM)
        setDeleteConfirm(null)
        setError('')
      }, 300)
    }
  }, [open])

  function openAdd() {
    setEditing(EMPTY_FORM)
    setError('')
    setMode('edit')
  }

  function openEdit(t: WaTag) {
    setEditing({ id: t.id, name: t.name, color: t.color as TagColor })
    setError('')
    setMode('edit')
  }

  function handleSave() {
    if (!editing.name.trim()) { setError('O nome não pode estar vazio.'); return }
    setError('')

    const formData = new FormData()
    if (editing.id) formData.set('id', editing.id)
    formData.set('name', editing.name)
    formData.set('color', editing.color)

    startTransition(async () => {
      const result = editing.id ? await updateTag(formData) : await createTag(formData)
      if (!result.success) {
        if (result.code === 'NOME_DUPLICADO') {
          setError(result.message ?? 'Já existe uma tag com esse nome.')
        } else {
          setError('Erro ao salvar. Tente novamente.')
        }
        return
      }
      // Atualização otimista local
      if (result.tag) {
        setTags(prev =>
          editing.id
            ? prev.map(t => t.id === editing.id ? result.tag! : t)
            : [...prev, result.tag!].sort((a, b) => a.name.localeCompare(b.name))
        )
      }
      setMode('list')
    })
  }

  function handleDelete(id: string) {
    if (deleteConfirm === id) {
      setDeleteConfirm(null)
      startTransition(async () => {
        const result = await deleteTag(id)
        if (!result.success) {
          if (result.code === 'TAG_EM_USO') {
            setError(result.message ?? 'Tag em uso em conversas.')
          } else {
            setError('Erro ao excluir.')
          }
          return
        }
        setTags(prev => prev.filter(t => t.id !== id))
      })
    } else {
      setDeleteConfirm(id)
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
          'transition-transform duration-300 ease-out max-h-[92dvh]'
          , visible ? 'translate-y-0' : 'translate-y-full'
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
              {mode === 'list' ? 'Tags' : editing.id ? 'Editar tag' : 'Nova tag'}
            </h2>
            {mode === 'list' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Categorize suas conversas
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
              {error && (
                <p className="px-4 pt-3 text-sm text-destructive">{error}</p>
              )}
              {tags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                  <Tag className="w-8 h-8 opacity-20" />
                  <p className="text-sm">Nenhuma tag criada</p>
                </div>
              ) : (
                <div className="divide-y">
                  {tags.map(t => {
                    const colors = TAG_COLOR_CLASSES[t.color] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }
                    return (
                      <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                        <span className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium flex-1 min-w-0',
                          colors.bg, colors.text
                        )}>
                          {t.name}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => openEdit(t)}
                            disabled={isPending}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground disabled:opacity-40"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={isPending}
                            className={cn(
                              'w-8 h-8 flex items-center justify-center rounded-full transition-colors disabled:opacity-40',
                              deleteConfirm === t.id
                                ? 'bg-destructive text-white'
                                : 'hover:bg-muted text-muted-foreground hover:text-destructive'
                            )}
                            title={deleteConfirm === t.id ? 'Toque novamente para confirmar' : 'Excluir'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="shrink-0 border-t px-4 py-3 bg-background">
              <button
                onClick={openAdd}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                Nova tag
              </button>
            </div>
          </>
        )}

        {/* ── MODO EDIÇÃO ──────────────────────────────────────── */}
        {mode === 'edit' && (
          <>
            <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4 space-y-5">
              {/* Nome */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Nome</label>
                <input
                  type="text"
                  value={editing.name}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: aguardando retirada"
                  maxLength={30}
                  className="w-full rounded-xl border bg-muted/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
                />
                <p className="text-xs text-muted-foreground">{editing.name.length}/30</p>
              </div>

              {/* Cor */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Cor</label>
                <div className="grid grid-cols-5 gap-3">
                  {TAG_COLORS.map(color => {
                    const dot = TAG_DOT_CLASSES[color]
                    const isSelected = editing.color === color
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditing(p => ({ ...p, color }))}
                        className={cn(
                          'w-10 h-10 rounded-full transition-all mx-auto relative flex items-center justify-center',
                          dot,
                          isSelected ? 'scale-110' : 'hover:scale-105 opacity-70 hover:opacity-100'
                        )}
                        title={color}
                      >
                        {isSelected && <Check className="w-4 h-4 text-white drop-shadow" strokeWidth={3} />}
                      </button>
                    )
                  })}
                </div>
                {/* Preview */}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">Preview:</span>
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                    TAG_COLOR_CLASSES[editing.color]?.bg ?? 'bg-muted',
                    TAG_COLOR_CLASSES[editing.color]?.text ?? 'text-muted-foreground'
                  )}>
                    {editing.name || 'nome da tag'}
                  </span>
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>

            <div className="shrink-0 border-t px-4 py-3 bg-background">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {isPending ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.body
  )
}
