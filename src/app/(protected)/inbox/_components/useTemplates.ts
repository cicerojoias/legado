'use client'

import { useState, useCallback } from 'react'
import { Template, TEMPLATES } from './templates'

const STORAGE_KEY = 'wab-templates'

function loadTemplates(): Template[] {
  if (typeof window === 'undefined') return TEMPLATES
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return TEMPLATES
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : TEMPLATES
  } catch {
    return TEMPLATES
  }
}

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>(loadTemplates)

  const persist = useCallback((next: Template[]) => {
    setTemplates(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }, [])

  const addTemplate = useCallback((t: Template) => {
    setTemplates(prev => {
      const next = [...prev, t]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const updateTemplate = useCallback((originalSlug: string, t: Template) => {
    setTemplates(prev => {
      const next = prev.map(p => p.slug === originalSlug ? t : p)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const deleteTemplate = useCallback((slug: string) => {
    setTemplates(prev => {
      const next = prev.filter(p => p.slug !== slug)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const matchTemplates = useCallback((query: string) => {
    const q = query.toLowerCase()
    return templates.filter(
      t => t.slug.startsWith(q) || t.label.toLowerCase().includes(q)
    )
  }, [templates])

  return { templates, addTemplate, updateTemplate, deleteTemplate, matchTemplates, persist }
}
