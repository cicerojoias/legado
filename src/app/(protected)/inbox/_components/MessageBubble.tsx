'use client'

import { useRef, useState, useEffect } from 'react'
import { Check, CheckCheck, FileText, Download, Reply } from 'lucide-react'
import { cn } from '@/lib/utils'

// Tipo local para evitar erro de exportação do Prisma Client
interface WaMessage {
  id: string
  content: string | null
  type: string
  direction: string
  status: string
  timestamp: Date | string
  mediaUrl?: string | null
  mimeType?: string | null
  replyToSnapshot?: string | null
}

interface MessageBubbleProps {
  message: WaMessage
  onReply?: () => void
}

const SWIPE_THRESHOLD = 60 // px para acionar reply
const SWIPE_MAX = 80       // px máximo de arrasto (rubber band)

/** Renderiza o corpo da mensagem conforme tipo e mimeType */
function MediaBody({ message, isOutbound }: { message: WaMessage; isOutbound: boolean }) {
  const { mediaUrl, mimeType, content, type } = message

  // ── Imagem ──────────────────────────────────────────────────────────────
  if (type === 'image' || mimeType?.startsWith('image/')) {
    return (
      <div className="mb-1">
        {mediaUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={mediaUrl}
            alt="imagem"
            className="max-w-full rounded-lg object-cover max-h-64 w-full"
            loading="lazy"
          />
        ) : (
          <span className="italic text-muted-foreground text-xs">[Imagem indisponível]</span>
        )}
        {content && content !== '[Imagem]' && (
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">{content}</p>
        )}
      </div>
    )
  }

  // ── Áudio ────────────────────────────────────────────────────────────────
  if (type === 'audio' || mimeType?.startsWith('audio/')) {
    return mediaUrl ? (
      <audio controls src={mediaUrl} className="w-full max-w-[280px] my-1 rounded" preload="metadata" />
    ) : (
      <span className="italic text-muted-foreground text-xs">[Áudio indisponível]</span>
    )
  }

  // ── Vídeo ────────────────────────────────────────────────────────────────
  if (type === 'video' || mimeType?.startsWith('video/')) {
    return mediaUrl ? (
      <video controls src={mediaUrl} className="w-full max-w-[280px] max-h-48 rounded-lg my-1" preload="metadata" />
    ) : (
      <span className="italic text-muted-foreground text-xs">[Vídeo indisponível]</span>
    )
  }

  // ── Documento / PDF ──────────────────────────────────────────────────────
  if (type === 'document' || mimeType === 'application/pdf') {
    const label = content && content !== '[Documento]' ? content : 'Documento'
    return mediaUrl ? (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-2 my-1 rounded-lg border px-3 py-2 text-sm transition-colors",
          isOutbound ? "bg-white/10 hover:bg-white/20 border-white/20" : "bg-black/5 hover:bg-black/10"
        )}
      >
        <FileText className="w-4 h-4 shrink-0 text-orange-500" />
        <span className="truncate max-w-[200px]">{label}</span>
        <Download className="w-3 h-3 ml-auto opacity-50" />
      </a>
    ) : (
      <span className="italic text-muted-foreground text-xs">[Documento indisponível]</span>
    )
  }

  // Se não for mídia reconhecida, mas tiver mediaUrl, mostra link de download
  if (mediaUrl) {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs underline block mb-1 opacity-70"
      >
        Ver anexo ({type})
      </a>
    )
  }

  return null
}

export function MessageBubble({ message, onReply }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'

  // ── Swipe-to-reply state ──────────────────────────────────────────────────
  const [dragX, setDragX] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragXRef = useRef(0)
  const onReplyRef = useRef(onReply)

  useEffect(() => { onReplyRef.current = onReply }, [onReply])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el || !onReply) return

    let startX = 0
    let startY = 0
    let active = false

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      active = false
    }

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      // Se movimento vertical dominante e ainda não confirmamos horizontal, ignora
      if (!active && Math.abs(dy) > Math.abs(dx)) return
      // Só ativa para arrasto para a direita
      if (dx <= 0) {
        if (active) { dragXRef.current = 0; setDragX(0) }
        return
      }

      active = true
      e.preventDefault() // bloqueia scroll vertical durante swipe horizontal
      const clamped = Math.min(dx, SWIPE_MAX)
      dragXRef.current = clamped
      setDragX(clamped)
    }

    const onTouchEnd = () => {
      if (active && dragXRef.current >= SWIPE_THRESHOLD) {
        onReplyRef.current?.()
      }
      dragXRef.current = 0
      setDragX(0)
      setSnapping(true)
      setTimeout(() => setSnapping(false), 200)
      active = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [onReply])

  const replyProgress = Math.min(dragX / SWIPE_THRESHOLD, 1)

  // ── Status icon ───────────────────────────────────────────────────────────
  const StatusIcon = () => {
    if (!isOutbound) return null
    if (message.status === 'delivered') return <CheckCheck className="w-3 h-3 text-muted-foreground" />
    if (message.status === 'read') return <CheckCheck className="w-3 h-3 text-accent" />
    if (message.status === 'failed') return <span className="text-[10px] text-destructive font-bold">!</span>
    return <Check className="w-3 h-3 text-muted-foreground" />
  }

  return (
    <div ref={wrapperRef} className="relative mb-2">
      {/* Ícone de reply fixo — aparece conforme o arrasto */}
      {onReply && (
        <div
          className="absolute left-1 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          style={{
            opacity: replyProgress,
            transform: `translateY(-50%) scale(${0.5 + replyProgress * 0.5})`,
            transition: snapping ? 'opacity 0.2s, transform 0.2s' : 'none',
          }}
        >
          <Reply className="w-5 h-5" />
        </div>
      )}

      {/* Linha da mensagem — desliza para direita */}
      <div
        className={cn(
          'group flex w-full items-end gap-1',
          isOutbound ? 'flex-row-reverse' : 'flex-row'
        )}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: snapping ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {/* Botão de reply no hover (desktop) */}
        {onReply && (
          <button
            onClick={onReply}
            className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground"
            title="Responder"
            aria-label="Responder mensagem"
          >
            <Reply className="w-4 h-4" />
          </button>
        )}

        <div
          className={cn(
            'relative max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-2xl shadow-sm',
            isOutbound
              ? 'bg-primary text-primary-foreground rounded-tr-none'
              : 'bg-card text-card-foreground border rounded-tl-none'
          )}
        >
          {/* Quote snippet — mensagem citada */}
          {message.replyToSnapshot && (
            <div
              className={cn(
                'mb-2 pl-2 border-l-2 rounded text-xs line-clamp-2 opacity-80',
                isOutbound ? 'border-white/60 bg-white/10 px-2 py-1' : 'border-primary/60 bg-primary/5 px-2 py-1'
              )}
            >
              {message.replyToSnapshot}
            </div>
          )}

          {/* Renderiza Mídia se houver */}
          <MediaBody message={message} isOutbound={isOutbound} />

          {/* Texto da Mensagem */}
          {message.content && message.type === 'text' && (
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {message.content}
            </p>
          )}

          {/* Rodapé: Hora e Status */}
          <div className="flex items-center gap-1 mt-1 text-[10px] opacity-70 justify-end">
            <span>{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' }).format(new Date(message.timestamp))}</span>
            <StatusIcon />
          </div>
        </div>
      </div>
    </div>
  )
}
