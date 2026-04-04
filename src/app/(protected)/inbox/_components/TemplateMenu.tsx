'use client'

import { useEffect, useRef } from 'react'
import { matchTemplates, Template } from './templates'

interface TemplateMenuProps {
  query: string
  onSelect: (template: Template) => void
  onClose: () => void
}

export function TemplateMenu({ query, onSelect, onClose }: TemplateMenuProps) {
  const matches = matchTemplates(query)
  const menuRef = useRef<HTMLDivElement>(null)

  // Fecha ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  if (matches.length === 0) return null

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-4 bg-background border rounded-xl shadow-lg overflow-hidden z-50"
    >
      <div className="px-3 py-1.5 border-b">
        <span className="text-xs text-muted-foreground font-medium">Templates</span>
      </div>
      {matches.map((t) => (
        <button
          key={t.slug}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault() // evita blur no textarea
            onSelect(t)
          }}
          className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-muted/60 transition-colors text-left"
        >
          <span className="text-xs font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5 shrink-0 mt-0.5">
            /{t.slug}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{t.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {t.content.split('\n')[0]}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
