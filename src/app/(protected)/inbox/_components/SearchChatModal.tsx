'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Search, Calendar, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchMessageResult {
  id: string
  content: string | null
  direction: string
  timestamp: string
}

interface SearchChatModalProps {
  open: boolean
  onClose: () => void
  conversationId: string
  contactName: string
}

function formatResultDate(ts: string) {
  const d = new Date(ts)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Destaca os termos buscados na mensagem
function highlightTerm(text: string, query: string) {
  const trimmed = query.trim()
  if (!trimmed) return <span>{text}</span>
  
  const regex = new RegExp(`(${trimmed.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  const queryLower = trimmed.toLowerCase()

  return (
    <>
      {parts.map((part, idx) =>
        part.toLowerCase() === queryLower ? (
          <mark key={idx} className="bg-accent/40 text-foreground font-medium rounded px-0.5">
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </>
  )
}

export function SearchChatModal({ open, onClose, conversationId, contactName }: SearchChatModalProps) {
  const [mounted, setMounted] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchMessageResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Efeito para pesquisar com debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

    if (!query.trim() || query.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortControllerRef.current = controller

      try {
        const res = await fetch(
          `/api/whatsapp/conversations/${conversationId}/search-messages?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal }
        )
        if (res.ok) {
          const data = await res.json()
          setResults(data.messages ?? [])
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Erro ao buscar mensagens:', err)
        }
      } finally {
        if (abortControllerRef.current === controller) {
          setLoading(false)
          abortControllerRef.current = null
        }
      }
    }, 400)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [query, conversationId])

  // Foco no input ao abrir
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150)
      setQuery('')
      setResults([])
    }
  }, [open])

  if (!mounted) return null

  const handleResultClick = (msg: SearchMessageResult) => {
    // Dispara evento global de navegação de scroll até a mensagem específica
    window.dispatchEvent(
      new CustomEvent('wab-scroll-to-message', {
        detail: {
          messageId: msg.id,
          timestamp: msg.timestamp,
        },
      })
    )
    onClose()
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="search-chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60"
            onClick={onClose}
          />

          {/* Modal / Bottom Sheet */}
          <motion.div
            key="search-chat-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[61] max-h-[85vh] rounded-t-2xl bg-background shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 shrink-0">
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold truncate">Buscar no chat</h2>
                <p className="text-xs text-muted-foreground truncate">{contactName}</p>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="border-t shrink-0" />

            {/* Input de busca */}
            <div className="px-4 py-3 shrink-0">
              <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Pesquisar mensagens antigas..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full rounded-full bg-muted/60 border text-sm pl-9 pr-8 py-2.5 outline-none focus:ring-2 focus:ring-primary/30"
                />
                {query && (
                  <button
                    onClick={() => {
                      setQuery('')
                      setResults([])
                      inputRef.current?.focus()
                    }}
                    className="absolute right-3 p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="border-t shrink-0" />

            {/* Conteúdo dos resultados */}
            <div className="flex-1 overflow-y-auto min-h-0 bg-muted/10">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
                  <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin mr-2" />
                  Buscando nas mensagens...
                </div>
              ) : query.trim().length < 2 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-xs gap-1.5 px-6 text-center">
                  <Search className="w-8 h-8 opacity-25 mb-1 text-primary" />
                  <p className="font-semibold text-sm">Digite uma palavra-chave</p>
                  <p>Escreva ao menos 2 letras para pesquisar no histórico desta conversa.</p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground text-xs gap-1 px-6 text-center">
                  <Search className="w-8 h-8 opacity-25 mb-1" />
                  <p className="font-semibold text-sm">Nenhum resultado encontrado</p>
                  <p>Não encontramos mensagens contendo &ldquo;{query}&rdquo;.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  <div className="px-4 py-2 bg-muted/20 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider sticky top-0 backdrop-blur z-10 border-b">
                    {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                  </div>
                  {results.map((msg) => {
                    const isOutbound = msg.direction === 'outbound'
                    return (
                      <button
                        key={msg.id}
                        onClick={() => handleResultClick(msg)}
                        className="w-full flex flex-col gap-1.5 px-4 py-3.5 text-left hover:bg-muted/50 transition-colors active:bg-muted/70 group"
                      >
                        <div className="flex items-center justify-between w-full gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full',
                              isOutbound ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            )}
                          >
                            <User className="w-3 h-3 shrink-0" />
                            {isOutbound ? 'Atendente' : 'Cliente'}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {formatResultDate(msg.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/80 font-normal break-words whitespace-pre-wrap leading-relaxed line-clamp-3 group-hover:text-foreground transition-colors">
                          {highlightTerm(msg.content ?? '', query)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="h-6 shrink-0 bg-background safe-area-bottom" />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}
