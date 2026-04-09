'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Check, ChevronDown, PencilLine, Plus, StickyNote, Trash2, X } from 'lucide-react'
import type { ConversationNoteWithAuthor } from './types'
import { createConversationNote, deleteConversationNote, updateConversationNote } from '../actions/notes'

interface ConversationNotesPanelProps {
  conversationId: string
  initialNotes: ConversationNoteWithAuthor[]
}

function formatNoteDate(value: Date | string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ConversationNotesPanel({ conversationId, initialNotes }: ConversationNotesPanelProps) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [editDraft, setEditDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const notes = initialNotes

  useEffect(() => {
    if (!editingId) return
    const current = notes.find((note) => note.id === editingId)
    if (!current) {
      setEditingId(null)
      setEditDraft('')
    }
  }, [editingId, notes])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`wab-notes-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wa_conversation_notes',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => router.refresh()
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'wa_conversation_notes',
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, router])

  async function handleCreate() {
    const content = draft.trim()
    if (!content || isSaving) return

    setIsSaving(true)
    try {
      const result = await createConversationNote(conversationId, content)
      if (result.success) {
        setDraft('')
        router.refresh()
      }
    } finally {
      setIsSaving(false)
    }
  }

  function beginEdit(note: ConversationNoteWithAuthor) {
    setEditingId(note.id)
    setEditDraft(note.content)
    setIsExpanded(true)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft('')
  }

  async function handleUpdate(noteId: string) {
    const content = editDraft.trim()
    if (!content || isSaving) return

    setIsSaving(true)
    try {
      const result = await updateConversationNote(conversationId, noteId, content)
      if (result.success) {
        cancelEdit()
        router.refresh()
      }
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(noteId: string) {
    if (isSaving) return
    if (!window.confirm('Excluir esta nota interna?')) return

    setIsSaving(true)
    try {
      const result = await deleteConversationNote(conversationId, noteId)
      if (result.success) {
        if (editingId === noteId) cancelEdit()
        router.refresh()
      }
    } finally {
      setIsSaving(false)
    }
  }

  const notesCount = notes.length

  return (
    <section className="border-b bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-xl border bg-background/60 px-3 py-2.5 text-left transition-colors hover:bg-background/80"
          aria-expanded={isExpanded}
          aria-controls="conversation-notes-panel"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
              <StickyNote className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="truncate text-sm font-semibold">Notas internas</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {isExpanded ? 'Fechar' : 'Abrir'}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Compartilhadas entre atendentes
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{notesCount}</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>

        <div
          id="conversation-notes-panel"
          className={`overflow-hidden transition-all duration-300 ease-out ${
            isExpanded ? 'mt-2 max-h-[30rem] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-2">
            <div className="space-y-2 rounded-xl border bg-background/70 p-2.5">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escreva uma nota curta para o próximo atendimento..."
                maxLength={2000}
                rows={3}
                className="min-h-20 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">{draft.length}/2000</p>
                <button
                  onClick={handleCreate}
                  disabled={!draft.trim() || isSaving}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-primary px-3.5 text-xs font-semibold text-primary-foreground transition-opacity disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Salvar
                </button>
              </div>
            </div>

            <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {notesCount === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                  Nenhuma nota ainda.
                </div>
              ) : (
                notes.map((note) => {
                  const authorName = note.author?.nome ?? note.author?.email ?? 'Usuário'
                  const isEditing = editingId === note.id
                  const isEdited = new Date(note.updated_at).getTime() - new Date(note.created_at).getTime() > 1000

                  return (
                    <article key={note.id} className="rounded-xl border bg-background/80 px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">{authorName}</span>
                            <span>{formatNoteDate(note.created_at)}</span>
                            {isEdited && <span>Editada</span>}
                          </div>

                          {isEditing ? (
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              rows={3}
                              maxLength={2000}
                              className="mt-2 min-h-20 w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                            />
                          ) : (
                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                              {note.content}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => handleUpdate(note.id)}
                                disabled={!editDraft.trim() || isSaving}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-emerald-600 transition-colors hover:bg-emerald-500/10 disabled:opacity-40"
                                aria-label="Salvar edição"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                disabled={isSaving}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                                aria-label="Cancelar edição"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => beginEdit(note)}
                                disabled={isSaving}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                                aria-label="Editar nota"
                              >
                                <PencilLine className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(note.id)}
                                disabled={isSaving}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-600 transition-colors hover:bg-red-500/10 disabled:opacity-40"
                                aria-label="Excluir nota"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
