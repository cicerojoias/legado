'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Search, Forward } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface ForwardConversation {
  id: string
  contact: { name: string | null; phone: string }
  last_message_at: string | null
  messages: Array<{ content: string | null; type: string; direction: string }>
}

interface ForwardModalProps {
  open: boolean
  onClose: () => void
  messageIds: string[]
  messageCount: number
  onForwarded: () => void
}

// ── Paleta de cores para avatares (hash determinístico) ───────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-orange-500',
  'bg-pink-500', 'bg-teal-500', 'bg-amber-600', 'bg-cyan-600',
  'bg-indigo-500', 'bg-rose-500',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function getInitials(name: string | null, phone: string): string {
  const src = name ?? phone
  return src.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getLastMessagePreview(msg: ForwardConversation['messages'][0] | undefined): string {
  if (!msg) return 'Sem mensagens'
  if (msg.type === 'image')    return '📷 Foto'
  if (msg.type === 'audio')    return '🎵 Áudio'
  if (msg.type === 'video')    return '🎥 Vídeo'
  if (msg.type === 'document') return '📄 Documento'
  return msg.content ?? '...'
}

// ── Componente ────────────────────────────────────────────────────────────────

export function ForwardModal({ open, onClose, messageIds, messageCount, onForwarded }: ForwardModalProps) {
  const [conversations, setConversations] = useState<ForwardConversation[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [forwarding, setForwarding] = useState(false)
  const [visible, setVisible] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Carregar conversas ao abrir ───────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    setSelected(new Set())
    setSearch('')
    setLoading(true)
    fetch('/api/whatsapp/conversations?status=all')
      .then(r => r.json())
      .then(data => setConversations(data.conversations ?? []))
      .catch(() => toast.error('Erro ao carregar conversas'))
      .finally(() => setLoading(false))
  }, [open])

  // ── Animação de entrada/saída ─────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      // Dois rAF para garantir que o translate-y-full inicial foi pintado
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    } else {
      setVisible(false)
    }
  }, [open])

  // ── Filtro por busca ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter(c =>
      (c.contact.name ?? '').toLowerCase().includes(q) ||
      c.contact.phone.includes(q)
    )
  }, [conversations, search])

  // ── Toggle de seleção ─────────────────────────────────────────────────────
  function toggleConversation(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Encaminhar ────────────────────────────────────────────────────────────
  async function handleForward() {
    if (selected.size === 0 || forwarding) return
    setForwarding(true)
    try {
      const res = await fetch('/api/whatsapp/forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds, conversationIds: [...selected] }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erro ao encaminhar')
        return
      }
      toast.success(
        selected.size === 1
          ? 'Mensagem encaminhada'
          : `Encaminhada para ${selected.size} conversas`
      )
      onForwarded()
      onClose()
    } catch {
      toast.error('Erro de rede ao encaminhar')
    } finally {
      setForwarding(false)
    }
  }

  // Não renderiza nada se fechado e sem animação pendente
  if (!open && !visible) return null

  const noneSelected = selected.size === 0
  const btnLabel = noneSelected
    ? 'Encaminhar'
    : selected.size === 1
      ? 'Encaminhar'
      : `Encaminhar para ${selected.size}`

  return (
    <>
      {/* ── Backdrop ────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-[60] bg-black/60 transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* ── Bottom sheet ────────────────────────────────────────────────────── */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[61] flex flex-col rounded-t-2xl bg-background shadow-2xl',
          'transition-transform duration-300 ease-out',
          'max-h-[82dvh]',
          visible ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div>
            <h2 className="text-base font-semibold">Encaminhar para</h2>
            {messageCount > 1 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {messageCount} mensagens
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de busca */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 rounded-full bg-muted/60 px-3 py-2.5">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Pesquisar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="border-t shrink-0" />

        {/* Lista de conversas */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-10">
              <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              {search.trim() ? 'Nenhuma conversa encontrada' : 'Sem conversas'}
            </p>
          ) : (
            filtered.map(conv => {
              const isSelected = selected.has(conv.id)
              const displayName = conv.contact.name ?? conv.contact.phone
              const initials = getInitials(conv.contact.name, conv.contact.phone)
              const color = avatarColor(displayName)
              const preview = getLastMessagePreview(conv.messages[0])

              return (
                <button
                  key={conv.id}
                  onClick={() => toggleConversation(conv.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 transition-colors text-left',
                    'active:bg-muted/60',
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/30'
                  )}
                >
                  {/* Avatar com indicador de seleção */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm transition-all duration-150',
                        isSelected ? 'bg-primary' : color
                      )}
                    >
                      {isSelected ? (
                        // Checkmark dentro do avatar (igual ao WhatsApp)
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        initials
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      'text-sm truncate',
                      isSelected ? 'font-semibold text-primary' : 'font-medium'
                    )}>
                      {displayName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {preview}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Footer — botão Encaminhar */}
        <div className="shrink-0 border-t px-4 py-3 bg-background safe-area-bottom">
          <button
            onClick={handleForward}
            disabled={noneSelected || forwarding}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-full py-3.5 text-sm font-semibold transition-all duration-150',
              !noneSelected
                ? 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed opacity-60'
            )}
          >
            {forwarding ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground animate-spin" />
            ) : (
              <>
                <Forward className="w-4 h-4" />
                {btnLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
