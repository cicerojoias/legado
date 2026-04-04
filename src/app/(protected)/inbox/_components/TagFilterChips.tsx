'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WaTag } from '@prisma/client'

// Classes literais para o compilador do Tailwind v4 não purgar
const TAG_CHIP_CLASSES: Record<string, { bg: string; text: string; ring: string }> = {
  amber:  { bg: 'bg-amber-100',  text: 'text-amber-800',  ring: 'ring-amber-400'  },
  rose:   { bg: 'bg-rose-100',   text: 'text-rose-800',   ring: 'ring-rose-400'   },
  sky:    { bg: 'bg-sky-100',    text: 'text-sky-800',    ring: 'ring-sky-400'    },
  violet: { bg: 'bg-violet-100', text: 'text-violet-800', ring: 'ring-violet-400' },
  orange: { bg: 'bg-orange-100', text: 'text-orange-800', ring: 'ring-orange-400' },
  teal:   { bg: 'bg-teal-100',   text: 'text-teal-800',   ring: 'ring-teal-400'   },
  pink:   { bg: 'bg-pink-100',   text: 'text-pink-800',   ring: 'ring-pink-400'   },
  indigo: { bg: 'bg-indigo-100', text: 'text-indigo-800', ring: 'ring-indigo-400' },
  lime:   { bg: 'bg-lime-100',   text: 'text-lime-800',   ring: 'ring-lime-400'   },
  cyan:   { bg: 'bg-cyan-100',   text: 'text-cyan-800',   ring: 'ring-cyan-400'   },
}

interface TagFilterChipsProps {
  tags: WaTag[]
}

export function TagFilterChips({ tags }: TagFilterChipsProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const activeTagId = searchParams.get('tag')

  function setTag(id: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (id) {
      params.set('tag', id)
    } else {
      params.delete('tag')
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  if (tags.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 px-3 py-2 border-b overflow-x-auto scrollbar-none shrink-0">
      {tags.map(tag => {
        const isActive = activeTagId === tag.id
        const colors = TAG_CHIP_CLASSES[tag.color] ?? {
          bg: 'bg-muted', text: 'text-muted-foreground', ring: 'ring-border',
        }
        return (
          <button
            key={tag.id}
            onClick={() => setTag(isActive ? null : tag.id)}
            className={cn(
              'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium shrink-0 transition-all',
              colors.bg, colors.text,
              isActive
                ? cn('ring-2 ring-offset-1', colors.ring)
                : 'opacity-70 hover:opacity-100'
            )}
          >
            {tag.name}
            {isActive && <X className="w-3 h-3 ml-0.5" />}
          </button>
        )
      })}
    </div>
  )
}
