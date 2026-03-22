import type { ConversationWithPreview } from './types'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Check, CheckCheck } from 'lucide-react'

interface ConversationItemProps {
  conversation: ConversationWithPreview
  isActive?: boolean
}

function formatTime(date: Date | string | null): string {
  if (!date) return ''
  const d = new Date(date)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)

  if (diffDays === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ontem'
  if (diffDays < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function ConversationItem({ conversation, isActive }: ConversationItemProps) {
  const { contact, messages, status, last_message_at } = conversation
  const lastMsg = messages[0]
  const initials = (contact.name ?? contact.phone)
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()

  return (
    <Link
      href={`/inbox/${conversation.id}`}
      className={cn(
        'flex items-center gap-3 px-4 py-3 transition-colors active:bg-muted/80',
        isActive ? 'bg-primary/10' : 'hover:bg-muted/50'
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm">
          {initials}
        </div>
        {status === 'open' && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-sm truncate">
            {contact.name ?? contact.phone}
          </p>
          <span className="text-xs text-muted-foreground shrink-0">
            {formatTime(last_message_at)}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
          {lastMsg && lastMsg.direction === 'outbound' && (
            <span className="shrink-0 flex items-center">
              {lastMsg.status === 'read' ? (
                <CheckCheck className="w-[14px] h-[14px] text-accent" />
              ) : lastMsg.status === 'delivered' ? (
                <CheckCheck className="w-[14px] h-[14px]" />
              ) : (
                <Check className="w-[14px] h-[14px]" />
              )}
            </span>
          )}
          <span className="truncate">
            {lastMsg ? lastMsg.content : 'Sem mensagens'}
          </span>
        </div>
      </div>
    </Link>
  )
}
