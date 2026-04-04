'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { assignTag, removeTag } from '../actions/tag-conversation'
import type { WaTag } from '@prisma/client'
import type { TagWithMeta } from './types'

// Classes literais para o compilador do Tailwind v4 não purgar
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

interface ConversationTagPanelProps {
  conversationId: string
  currentTags:    TagWithMeta[]
  availableTags:  WaTag[]
}

export function ConversationTagPanel({ conversationId, currentTags, availableTags }: ConversationTagPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const appliedTagIds = new Set(currentTags.map(ct => ct.tagId))
  const tagsToAdd = availableTags.filter(t => !appliedTagIds.has(t.id))

  function handleAssign(tagId: string) {
    setOpen(false)
    startTransition(async () => {
      await assignTag(conversationId, tagId)
      router.refresh()
    })
  }

  function handleRemove(tagId: string) {
    startTransition(async () => {
      await removeTag(conversationId, tagId)
      router.refresh()
    })
  }

  if (currentTags.length === 0 && availableTags.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
      {currentTags.map(ct => {
        const colors = TAG_COLOR_CLASSES[ct.tag.color] ?? { bg: 'bg-muted', text: 'text-muted-foreground' }
        return (
          <span
            key={ct.tagId}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
              colors.bg, colors.text
            )}
          >
            {ct.tag.name}
            <button
              onClick={() => handleRemove(ct.tagId)}
              disabled={isPending}
              className="hover:opacity-70 transition-opacity disabled:opacity-40"
              aria-label={`Remover tag ${ct.tag.name}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        )
      })}

      {availableTags.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen(v => !v)}
            disabled={isPending || tagsToAdd.length === 0}
            className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center transition-colors',
              'bg-muted text-muted-foreground hover:bg-muted/80',
              'disabled:opacity-40 disabled:cursor-not-allowed'
            )}
            aria-label="Adicionar tag"
            title={tagsToAdd.length === 0 ? 'Todas as tags já aplicadas' : 'Adicionar tag'}
          >
            <Plus className="w-3 h-3" />
          </button>

          {open && tagsToAdd.length > 0 && (
            <div className="absolute left-0 top-6 z-50 min-w-[160px] rounded-xl shadow-lg bg-card border p-1.5 flex flex-col gap-0.5">
              {tagsToAdd.map(t => {
                const dot = TAG_DOT_CLASSES[t.color] ?? 'bg-muted-foreground'
                return (
                  <button
                    key={t.id}
                    onClick={() => handleAssign(t.id)}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg hover:bg-muted/60 transition-colors text-left w-full"
                  >
                    <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', dot)} />
                    {t.name}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
