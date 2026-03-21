import type { WaMessage } from '@prisma/client'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: WaMessage
}

function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'read') return <span className="text-blue-400">✓✓</span>
  if (status === 'delivered') return <span className="text-muted-foreground">✓✓</span>
  return <span className="text-muted-foreground">✓</span>
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'

  return (
    <div className={cn('flex', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] md:max-w-[65%] rounded-2xl px-3 py-2 text-sm shadow-sm',
          isOutbound
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-card border rounded-bl-sm'
        )}
      >
        {message.type !== 'text' ? (
          <span className="italic text-muted-foreground">
            [{message.type}]
          </span>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        )}
        <div
          className={cn(
            'flex items-center gap-1 mt-1 text-[10px]',
            isOutbound ? 'justify-end text-primary-foreground/70' : 'justify-end text-muted-foreground'
          )}
        >
          <span>{formatTime(message.timestamp)}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  )
}
