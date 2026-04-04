'use client'

import { useState, useEffect, useRef, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { Search, X, MoreVertical } from 'lucide-react'
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon'
import { cn } from '@/lib/utils'
import { TemplatesManagerModal } from './TemplatesManagerModal'
import { TagsManagerModal } from './TagsManagerModal'
import { WABSettingsModal } from './WABSettingsModal'
import { UnreadFilterTabs } from './UnreadFilterTabs'
import { TagFilterChips } from './TagFilterChips'
import type { WaTag, WaSettings } from '@prisma/client'

// ─── Tipos das respostas da API ───────────────────────────────────────────────
interface SearchContact {
  id: string
  name: string | null
  phone: string
  conversations: { id: string }[]
}

interface SearchMessage {
  id: string
  content: string | null
  direction: string
  timestamp: string
  conversation: {
    id: string
    contact: { name: string | null; phone: string }
  }
}

interface SearchResults {
  contacts: SearchContact[]
  messages: SearchMessage[]
}

function formatTime(ts: string) {
  const d = new Date(ts)
  const diffDays = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function highlight(text: string, query: string) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return <span>{text}</span>
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-accent/40 text-foreground rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

interface ConversationSidebarProps {
  children:         React.ReactNode
  activeId?:        string
  unreadTotal?:     number
  tags?:            WaTag[]
  userRole?:        string
  initialSettings?: WaSettings | null
}

export function ConversationSidebar({ children, activeId, unreadTotal = 0, tags = [], userRole, initialSettings = null }: ConversationSidebarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [tagsManagerOpen, setTagsManagerOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN'

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/whatsapp/search?q=${encodeURIComponent(q)}`)
      if (res.ok) setResults(await res.json())
    } catch { /* silenciar */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const clearSearch = () => {
    setQuery('')
    setResults(null)
    inputRef.current?.focus()
  }

  const isSearching = query.length >= 2
  const hasResults = results && (results.contacts.length > 0 || results.messages.length > 0)

  return (
    <div className="w-full md:w-[360px] md:border-r flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
        <WhatsAppIcon className="w-5 h-5 text-primary shrink-0" />
        <h1 className="font-semibold text-base flex-1">WhatsApp</h1>
        <button
          onClick={() => setSettingsOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title="Configurações"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      <TemplatesManagerModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <TagsManagerModal
        open={tagsManagerOpen}
        onClose={() => setTagsManagerOpen(false)}
        initialTags={tags}
      />
      <WABSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenTemplates={() => setTemplatesOpen(true)}
        onOpenTags={() => setTagsManagerOpen(true)}
        tags={tags}
        initialSettings={initialSettings}
      />

      {/* Barra de busca */}
      <div className="px-3 py-2 border-b shrink-0">
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full rounded-full bg-muted/60 border text-sm pl-9 pr-8 py-2 outline-none focus:ring-2 focus:ring-primary/30"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Limpar busca"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs de filtro — ocultas durante busca */}
      {!isSearching && (
        <>
          <Suspense fallback={null}>
            <UnreadFilterTabs unreadTotal={unreadTotal} />
          </Suspense>
          {tags.length > 0 && (
            <Suspense fallback={null}>
              <TagFilterChips tags={tags} />
            </Suspense>
          )}
        </>
      )}

      {/* Conteúdo scrollável */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {!isSearching ? (
          // Lista normal de conversas (server component passado como children)
          children
        ) : loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
            <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
            Buscando...
          </div>
        ) : !hasResults ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm gap-2">
            <Search className="w-8 h-8 opacity-20" />
            <p>Nenhum resultado para &ldquo;{query}&rdquo;</p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {/* Seção: Contatos */}
            {results.contacts.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Contatos
                </p>
                {results.contacts.map((c) => {
                  const convId = c.conversations[0]?.id
                  const displayName = c.name ?? c.phone
                  return (
                    <Link
                      key={c.id}
                      href={convId ? `/inbox/${convId}` : '/inbox'}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                        convId === activeId && 'bg-primary/10'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {displayName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{highlight(displayName, query)}</p>
                        {c.name && (
                          <p className="text-xs text-muted-foreground truncate">{highlight(c.phone, query)}</p>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </>
            )}

            {/* Seção: Mensagens */}
            {results.messages.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Mensagens
                </p>
                {results.messages.map((m) => {
                  const contactName = m.conversation.contact.name ?? m.conversation.contact.phone
                  return (
                    <Link
                      key={m.id}
                      href={`/inbox/${m.conversation.id}`}
                      className={cn(
                        'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50',
                        m.conversation.id === activeId && 'bg-primary/10'
                      )}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                        {contactName.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium truncate">{contactName}</p>
                          <span className="text-xs text-muted-foreground shrink-0">{formatTime(m.timestamp)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {m.content ? highlight(m.content, query) : '[Mídia]'}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
