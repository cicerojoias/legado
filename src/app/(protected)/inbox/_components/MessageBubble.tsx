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
  reaction?: string | null
}

interface MessageBubbleProps {
  message: WaMessage
  onReply?: () => void
  onReact?: (emoji: string) => void
}

const SWIPE_THRESHOLD = 60 // px para acionar reply
const SWIPE_MAX = 80       // px máximo de arrasto (rubber band)
const LONG_PRESS_MS = 500  // ms para acionar o picker de reações
const REACTIONS = ['✅', '💚', '🤝', '🙏'] as const

// Alturas aproximadas do header (ContactHeader) e do footer (MessageInput)
// usadas para calcular se há espaço suficiente acima ou abaixo para o picker
const HEADER_H = 60  // px
const FOOTER_H = 72  // px
const PICKER_H = 56  // px (h-10 dos botões + padding vertical)

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

export function MessageBubble({ message, onReply, onReact }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'

  // ── Swipe-to-reply state ──────────────────────────────────────────────────
  const [dragX, setDragX] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragXRef = useRef(0)
  const onReplyRef = useRef(onReply)
  const onReactRef = useRef(onReact)

  useEffect(() => { onReplyRef.current = onReply }, [onReply])
  useEffect(() => { onReactRef.current = onReact }, [onReact])

  // ── Reaction picker state ─────────────────────────────────────────────────
  const [showPicker, setShowPicker] = useState(false)
  const [pickerDir, setPickerDir] = useState<'above' | 'below'>('above')
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref para leitura síncrona dentro dos listeners nativos (closure não captura state)
  const showPickerRef = useRef(false)
  useEffect(() => { showPickerRef.current = showPicker }, [showPicker])

  // Fechar picker ao clicar/tocar fora — usa 'click' (dispara após touchend,
  // depois que o onClick do emoji já foi processado pelo React)
  useEffect(() => {
    if (!showPicker) return
    const close = () => setShowPicker(false)
    document.addEventListener('click', close, { once: true })
    return () => { document.removeEventListener('click', close) }
  }, [showPicker])

  // ── Touch listeners: swipe + long press ──────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let active = false

    const onTouchStart = (e: TouchEvent) => {
      // Picker aberto — ignorar touchstart para não iniciar novo timer
      if (showPickerRef.current) return

      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      active = false

      // Iniciar timer de long press
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null
        // Decidir direção do picker com base no espaço disponível
        const rect = el.getBoundingClientRect()
        const spaceAbove = rect.top - HEADER_H
        const spaceBelow = window.innerHeight - rect.bottom - FOOTER_H
        setPickerDir(spaceAbove >= PICKER_H || spaceAbove >= spaceBelow ? 'above' : 'below')
        setShowPicker(true)
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX
      const dy = e.touches[0].clientY - startY

      // Cancelar long press se o dedo moveu
      if ((Math.abs(dx) > 8 || Math.abs(dy) > 8) && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }

      // Lógica de swipe-to-reply
      if (!onReplyRef.current) return
      if (!active && Math.abs(dy) > Math.abs(dx)) return
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
      // Cancelar long press pendente
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }

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
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, []) // refs são estáveis — sem deps necessárias

  const replyProgress = Math.min(dragX / SWIPE_THRESHOLD, 1)

  // ── Status icon ───────────────────────────────────────────────────────────
  const StatusIcon = () => {
    if (!isOutbound) return null
    if (message.status === 'delivered') return <CheckCheck className="w-3 h-3 text-muted-foreground" />
    if (message.status === 'read') return <CheckCheck className="w-3 h-3 text-accent" />
    if (message.status === 'failed') return <span className="text-[10px] text-destructive font-bold">!</span>
    return <Check className="w-3 h-3 text-muted-foreground" />
  }

  const handleEmojiSelect = (emoji: string) => {
    // Toggle: se o mesmo emoji já está selecionado, remove
    const next = message.reaction === emoji ? '' : emoji
    onReactRef.current?.(next)
    setShowPicker(false)
  }

  return (
    <div ref={wrapperRef} className="relative mb-4">
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

        {/* Bolha + picker de reações */}
        <div className="relative">
          {/* Picker de reações — direção calculada no long-press */}
          {showPicker && (
            <div
              className={cn(
                'absolute z-50 flex items-center gap-0.5',
                'bg-background border rounded-full shadow-xl px-2 py-1.5',
                pickerDir === 'above' ? 'bottom-full mb-2' : 'top-full mt-2',
                isOutbound ? 'right-0' : 'left-0'
              )}
            >
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleEmojiSelect(emoji)}
                  className={cn(
                    'w-10 h-10 flex items-center justify-center rounded-full text-xl transition-transform active:scale-90',
                    'hover:bg-muted',
                    message.reaction === emoji && 'bg-primary/10 ring-2 ring-primary/30'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
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

          {/* Badge de reação — aparece abaixo da bolha */}
          {message.reaction && (
            <button
              onClick={() => onReactRef.current?.('')}
              className={cn(
                'absolute -bottom-3 z-10',
                'flex items-center justify-center w-6 h-6 rounded-full',
                'bg-background border shadow-sm text-base leading-none',
                'hover:scale-110 transition-transform active:scale-90',
                isOutbound ? '-left-1' : '-right-1'
              )}
              title="Remover reação"
            >
              {message.reaction}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
