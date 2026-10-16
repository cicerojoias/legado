'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { perfHas, perfMark } from '@/lib/client-perf'
import { getPendingChatPreview } from './chat-preview'

const noopSubscribe = () => () => {}

const BUBBLES = [
  { side: 'left', w: 'w-40' },
  { side: 'right', w: 'w-56' },
  { side: 'left', w: 'w-64' },
  { side: 'left', w: 'w-32' },
  { side: 'right', w: 'w-48' },
  { side: 'right', w: 'w-28' },
  { side: 'left', w: 'w-52' },
] as const

/**
 * Esqueleto do chat exibido no instante do clique. Mostra nome/iniciais do contato
 * (já conhecidos pela lista) para a transição parecer o WhatsApp nativo.
 */
export function ChatSkeleton() {
  const router = useRouter()
  // Snapshot do servidor é null: o HTML inicial não diverge na hidratação
  const preview = useSyncExternalStore(noopSubscribe, getPendingChatPreview, () => null)

  useEffect(() => {
    if (perfHas('chat-open')) perfMark('chat-open', 'abrir chat (clique → esqueleto)')
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-h-0">
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        <button
          onClick={() => router.back()}
          className="md:hidden p-1 -ml-1 text-muted-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {preview?.initials}
        </div>
        {preview ? (
          <p className="font-semibold text-sm truncate">{preview.name}</p>
        ) : (
          <div className="h-3.5 w-36 bg-muted animate-pulse rounded" />
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden px-4 py-4 flex flex-col justify-end gap-2">
        {BUBBLES.map((b, i) => (
          <div key={i} className={b.side === 'right' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`h-9 ${b.w} rounded-2xl animate-pulse ${b.side === 'right' ? 'bg-primary/15' : 'bg-muted'}`}
            />
          </div>
        ))}
      </div>

      <div className="border-t bg-background px-3 py-2 shrink-0">
        <div className="h-10 rounded-full bg-muted/60 border" />
      </div>
    </div>
  )
}
