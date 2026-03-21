'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { WaContact, WaConversation } from '@prisma/client'

interface ContactHeaderProps {
  contact: WaContact
  conversation: WaConversation
  showBackButton?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  resolved: 'Resolvida',
  waiting: 'Aguardando',
}

export function ContactHeader({ contact, conversation, showBackButton }: ContactHeaderProps) {
  const router = useRouter()
  const [resolving, setResolving] = useState(false)
  const [status, setStatus] = useState(conversation.status)

  async function handleResolve() {
    setResolving(true)
    try {
      const res = await fetch(`/api/whatsapp/conversations/${conversation.id}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error()
      setStatus('resolved')
      toast.success('Conversa marcada como resolvida')
    } catch {
      toast.error('Erro ao resolver conversa')
    } finally {
      setResolving(false)
    }
  }

  const initials = (contact.name ?? contact.phone)
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
      {/* Botão voltar — só no mobile */}
      {showBackButton && (
        <button
          onClick={() => router.back()}
          className="md:hidden p-1 -ml-1 text-muted-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      )}

      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">
          {contact.name ?? contact.phone}
        </p>
        <p className="text-xs text-muted-foreground">
          {contact.name ? contact.phone : ''}
        </p>
      </div>

      {/* Badge de status */}
      <span
        className={cn(
          'text-xs px-2 py-0.5 rounded-full font-medium',
          status === 'open' && 'bg-green-500/10 text-green-600',
          status === 'resolved' && 'bg-muted text-muted-foreground',
          status === 'waiting' && 'bg-yellow-500/10 text-yellow-600',
        )}
      >
        {STATUS_LABELS[status] ?? status}
      </span>

      {/* Botão resolver */}
      {status === 'open' && (
        <button
          onClick={handleResolve}
          disabled={resolving}
          className="p-1.5 text-green-600 hover:bg-green-500/10 rounded-lg transition-colors disabled:opacity-40"
          title="Marcar como resolvida"
        >
          <CheckCircle className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
