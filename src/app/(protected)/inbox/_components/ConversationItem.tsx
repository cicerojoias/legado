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
  const { contact, messages, status, last_message_at, unreadCount } = conversation
  const lastMsg = messages[0]
  const hasUnread = unreadCount > 0
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
          <p className={cn('text-sm truncate', hasUnread ? 'font-bold' : 'font-semibold')}>
            {contact.name ?? contact.phone}
          </p>
          <span className={cn('text-xs shrink-0', hasUnread ? 'text-green-600 font-medium' : 'text-muted-foreground')}>
            {formatTime(last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
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
            <span className={cn('truncate', hasUnread && 'text-foreground font-medium')}>
              {lastMsg ? lastMsg.content : 'Sem mensagens'}
            </span>
          </div>
          {hasUnread && (
            <span className="shrink-0 min-w-[20px] h-5 bg-green-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
