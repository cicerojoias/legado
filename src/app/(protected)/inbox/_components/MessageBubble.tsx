'use client'

import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check, CheckCheck, FileText, Download, Reply, Smile, CheckCircle2, Ban, Forward, Clock, X, ZoomIn } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useSelectionState, useSelectionActions } from './SelectionContext'
import { AudioPlayer } from './AudioPlayer'

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
  wa_message_id?: string | null
  forwarded?: boolean | null
}

interface MessageBubbleProps {
  message: WaMessage
  onReply?: () => void
  onReact?: (emoji: string) => void
}

const SWIPE_THRESHOLD = 60 // px para acionar reply
const SWIPE_MAX = 80       // px máximo de arrasto (rubber band)
const LONG_PRESS_MS = 500  // ms para acionar long press
const REACTIONS = ['✅', '💚', '🤝', '🙏'] as const

// Alturas aproximadas do header e footer para posicionar o picker
const HEADER_H = 60
const FOOTER_H = 72
const PICKER_H = 56

/** Renderiza o corpo da mensagem conforme tipo e mimeType */
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [transitioning, setTransitioning] = useState(false)
  const [dragging, setDragging] = useState(false)

  const zoomRef = useRef(1)
  const panRef = useRef({ x: 0, y: 0 })
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null)
  const dragRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const lastTapRef = useRef(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  function clamp(v: number) { return Math.max(1, Math.min(5, v)) }

  function snapReset() {
    setTransitioning(true)
    zoomRef.current = 1
    panRef.current = { x: 0, y: 0 }
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setTimeout(() => setTransitioning(false), 220)
  }

  function snapZoom(target: number) {
    setTransitioning(true)
    zoomRef.current = target
    setZoom(target)
    setTimeout(() => setTransitioning(false), 220)
  }

  // ESC + body scroll lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      zoomRef.current > 1 ? snapReset() : onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  // Native wheel + touchmove (passive: false obrigatório para preventDefault)
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const next = clamp(zoomRef.current * (e.deltaY > 0 ? 0.9 : 1.1))
      zoomRef.current = next
      setZoom(next)
      if (next === 1) { panRef.current = { x: 0, y: 0 }; setPan({ x: 0, y: 0 }) }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault()
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const next = clamp(pinchRef.current.zoom * (Math.sqrt(dx * dx + dy * dy) / pinchRef.current.dist))
        zoomRef.current = next
        setZoom(next)
      } else if (e.touches.length === 1 && dragRef.current) {
        e.preventDefault()
        const np = {
          x: dragRef.current.px + (e.touches[0].clientX - dragRef.current.x),
          y: dragRef.current.py + (e.touches[0].clientY - dragRef.current.y),
        }
        panRef.current = np
        setPan(np)
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => { el.removeEventListener('wheel', onWheel); el.removeEventListener('touchmove', onTouchMove) }
  }, [])

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      pinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), zoom: zoomRef.current }
      dragRef.current = null
    } else if (e.touches.length === 1) {
      const now = Date.now()
      if (now - lastTapRef.current < 280) {
        lastTapRef.current = 0
        zoomRef.current > 1 ? snapReset() : snapZoom(2.5)
        return
      }
      lastTapRef.current = now
      if (zoomRef.current > 1) {
        dragRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: panRef.current.x, py: panRef.current.y }
      }
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) { dragRef.current = null; setDragging(false) }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (zoomRef.current <= 1) return
    e.preventDefault()
    dragRef.current = { x: e.clientX, y: e.clientY, px: panRef.current.x, py: panRef.current.y }
    setDragging(true)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return
    const np = {
      x: dragRef.current.px + (e.clientX - dragRef.current.x),
      y: dragRef.current.py + (e.clientY - dragRef.current.y),
    }
    panRef.current = np
    setPan(np)
  }

  function handleMouseUp() { dragRef.current = null; setDragging(false) }

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={() => { zoomRef.current > 1 ? snapReset() : onClose() }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
        onClick={e => { e.stopPropagation(); onClose() }}
        aria-label="Fechar"
      >
        <X className="w-6 h-6" />
      </button>

      <motion.div
        ref={wrapRef}
        className="flex items-center justify-center"
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        style={{ touchAction: 'none' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="imagem ampliada"
          className="max-w-[92vw] max-h-[90vh] rounded-xl object-contain shadow-2xl select-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            willChange: 'transform',
            transition: transitioning ? 'transform 0.2s ease-out' : 'none',
            cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          draggable={false}
        />
      </motion.div>
    </motion.div>,
    document.body
  )
}

function MediaBody({ message, isOutbound }: { message: WaMessage; isOutbound: boolean }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const { mediaUrl, mimeType, content, type } = message

  // ── Imagem ──────────────────────────────────────────────────────────────
  if (type === 'image' || mimeType?.startsWith('image/')) {
    return (
      <div className="mb-1">
        {mediaUrl ? (
          <>
            <div
              className="relative group cursor-zoom-in"
              onClick={() => setLightboxSrc(mediaUrl)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl}
                alt="imagem"
                className="max-w-full rounded-lg object-cover max-h-64 w-full"
                loading="lazy"
                draggable={false}
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                <ZoomIn className="w-8 h-8 text-white drop-shadow-md" />
              </div>
            </div>
            <AnimatePresence>
              {lightboxSrc && (
                <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
              )}
            </AnimatePresence>
          </>
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
      <AudioPlayer src={mediaUrl} isOutbound={isOutbound} />
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

  // ── Todos os hooks devem ser chamados incondicionalmente (React Rules of Hooks) ──
  // O early-return para mensagens apagadas vem DEPOIS deste bloco.

  // ── Selection context ─────────────────────────────────────────────────────
  const { active, selected } = useSelectionState()
  const { enter, toggle } = useSelectionActions()
  const isSelected = selected.has(message.id)

  // Refs estáveis para closures nos listeners nativos
  const enterRef = useRef(enter)
  const toggleRef = useRef(toggle)
  useEffect(() => { enterRef.current = enter }, [enter])
  useEffect(() => { toggleRef.current = toggle }, [toggle])

  // activeRef: leitura síncrona dentro de handlers nativos (closure não captura state)
  const activeRef = useRef(active)
  useEffect(() => { activeRef.current = active }, [active])

  // ── Swipe-to-reply state ──────────────────────────────────────────────────
  const [dragX, setDragX] = useState(0)
  const [snapping, setSnapping] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const dragXRef = useRef(0)
  const onReplyRef = useRef(onReply)
  const onReactRef = useRef(onReact)

  useEffect(() => { onReplyRef.current = onReply }, [onReply])
  useEffect(() => { onReactRef.current = onReact }, [onReact])

  const messageRef = useRef({
    id: message.id,
    content: message.content,
    type: message.type,
    direction: message.direction,
    timestamp: message.timestamp,
    wa_message_id: message.wa_message_id ?? null,
  })
  useEffect(() => {
    messageRef.current = {
      id: message.id,
      content: message.content,
      type: message.type,
      direction: message.direction,
      timestamp: message.timestamp,
      wa_message_id: message.wa_message_id ?? null,
    }
  }, [message.id, message.content, message.type, message.direction, message.timestamp, message.wa_message_id])

  // ── Reaction picker state ─────────────────────────────────────────────────
  // Picker agora é acionado pelo botão Smile (não mais por long press)
  const [showPicker, setShowPicker] = useState(false)
  const [pickerDir, setPickerDir] = useState<'above' | 'below'>('above')
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showPickerRef = useRef(false)
  useEffect(() => { showPickerRef.current = showPicker }, [showPicker])

  // Fechar picker ao clicar fora
  useEffect(() => {
    if (!showPicker) return
    const close = () => setShowPicker(false)
    document.addEventListener('click', close, { once: true })
    return () => { document.removeEventListener('click', close) }
  }, [showPicker])

  // Abrir picker de reações — calcula direção conforme espaço disponível
  const openPicker = () => {
    if (!wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const spaceAbove = rect.top - HEADER_H
    const spaceBelow = window.innerHeight - rect.bottom - FOOTER_H
    setPickerDir(spaceAbove >= PICKER_H || spaceAbove >= spaceBelow ? 'above' : 'below')
    setShowPicker(true)
  }

  // ── Touch listeners: swipe + long press ──────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return

    let startX = 0
    let startY = 0
    let swiping = false        // evita conflito com `active` do selection context
    let longPressFired = false

    const onTouchStart = (e: TouchEvent) => {
      if (showPickerRef.current) return

      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      swiping = false
      longPressFired = false

      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null
        longPressFired = true

        if (activeRef.current) return // selection mode ativo: long press é no-op

        // Entra no modo seleção com esta mensagem
        enterRef.current(messageRef.current)
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

      // Swipe desativado em modo seleção
      if (activeRef.current) return
      if (!onReplyRef.current) return
      if (!swiping && Math.abs(dy) > Math.abs(dx)) return
      if (dx <= 0) {
        if (swiping) { dragXRef.current = 0; setDragX(0) }
        return
      }

      swiping = true
      e.preventDefault()
      const clamped = Math.min(dx, SWIPE_MAX)
      dragXRef.current = clamped
      setDragX(clamped)
    }

    const onTouchEnd = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }

      // Tap curto em modo seleção → toggle
      if (!longPressFired && !swiping && activeRef.current) {
        toggleRef.current(messageRef.current)
      }

      // Swipe completo → reply
      if (!activeRef.current && swiping && dragXRef.current >= SWIPE_THRESHOLD) {
        onReplyRef.current?.()
      }

      dragXRef.current = 0
      setDragX(0)
      setSnapping(true)
      setTimeout(() => setSnapping(false), 200)
      swiping = false
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })

    // ── Mouse listeners: long press desktop ─────────────────────────────────
    let mouseDown = false
    let mouseLongPressFired = false
    let mouseStartX = 0
    let mouseStartY = 0

    const onMouseDown = (e: MouseEvent) => {
      // Apenas botão esquerdo
      if (e.button !== 0) return
      if (showPickerRef.current) return
      // Ignorar clicks em elementos interativos (botões, links, áudio, vídeo)
      const target = e.target as HTMLElement
      if (target.closest('button, a, input, textarea, video, audio, [role="button"]')) return

      mouseDown = true
      mouseLongPressFired = false
      mouseStartX = e.clientX
      mouseStartY = e.clientY

      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null
        mouseLongPressFired = true
        if (activeRef.current) return
        enterRef.current(messageRef.current)
      }, LONG_PRESS_MS)
    }

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseDown) return
      const dx = e.clientX - mouseStartX
      const dy = e.clientY - mouseStartY
      if ((Math.abs(dx) > 8 || Math.abs(dy) > 8) && longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }

    const onMouseUp = (e: MouseEvent) => {
      if (!mouseDown) return
      mouseDown = false
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
      // Em modo seleção: click simples toggla
      if (!mouseLongPressFired && activeRef.current) {
        const target = e.target as HTMLElement
        if (target.closest('button, a, input, textarea, video, audio, [role="button"]')) return
        toggleRef.current(messageRef.current)
      }
    }

    const onMouseLeave = () => {
      if (!mouseDown) return
      mouseDown = false
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current)
        longPressTimerRef.current = null
      }
    }

    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseup', onMouseUp)
    el.addEventListener('mouseleave', onMouseLeave)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('mousedown', onMouseDown)
      el.removeEventListener('mousemove', onMouseMove)
      el.removeEventListener('mouseup', onMouseUp)
      el.removeEventListener('mouseleave', onMouseLeave)
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [messageRef]) // refs são estáveis — sem deps necessárias

  // ── Mensagem apagada — renderização simplificada (após todos os hooks) ─────
  if (message.type === 'deleted') {
    return (
      <div className="relative mb-4">
        <div className="flex w-full items-end">
          <div
            className={cn(
              'px-3 py-2 rounded-2xl max-w-[85%] sm:max-w-[70%]',
              isOutbound
                ? 'bg-primary/20 text-primary-foreground/60 rounded-tr-none ml-auto'
                : 'bg-card border text-muted-foreground rounded-tl-none'
            )}
          >
            <p className="text-sm italic flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 shrink-0 opacity-70" />
              Mensagem apagada
            </p>
            <div className="flex items-center gap-1 mt-1 text-[10px] opacity-50 justify-end">
              <span>
                {new Intl.DateTimeFormat('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                  timeZone: 'America/Recife',
                }).format(new Date(message.timestamp))}
              </span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const replyProgress = Math.min(dragX / SWIPE_THRESHOLD, 1)

  const handleEmojiSelect = (emoji: string) => {
    const next = message.reaction === emoji ? '' : emoji
    onReactRef.current?.(next)
    setShowPicker(false)
  }

  const statusIcon = isOutbound ? (() => {
    if (message.status === 'pending') return <span title="Aguardando envio"><Clock className="w-3 h-3 opacity-50" /></span>
    if (message.status === 'delivered') return <span title="Entregue"><CheckCheck className="w-3 h-3 opacity-60" /></span>
    if (message.status === 'read') return <span title="Lida pelo cliente"><CheckCheck className="w-3.5 h-3.5 text-blue-300" /></span>
    if (message.status === 'failed') return <span className="text-[10px] text-destructive font-bold" title="Falha no envio">!</span>
    return <span title="Enviada"><Check className="w-3 h-3 opacity-50" /></span>
  })() : null

  return (
    <div
      ref={wrapperRef}
      className={cn(
        'relative mb-4 rounded-lg transition-colors',
        // Highlight de seleção — usa cor primary do projeto (#184434)
        isSelected && 'bg-primary/10',
        // user-select: none em modo seleção para evitar seleção de texto nativa
        active && 'select-none'
      )}
    >
      {/* Ícone de swipe-to-reply — mobile only, acompanha progresso do arrasto */}
      {onReply && !active && (
        <div
          className="absolute left-3 inset-y-0 flex items-center text-muted-foreground pointer-events-none md:hidden"
          style={{
            opacity: replyProgress,
            transform: `scale(${0.5 + replyProgress * 0.5})`,
            transition: snapping ? 'opacity 0.2s, transform 0.2s' : 'none',
          }}
        >
          <Reply className="w-5 h-5" />
        </div>
      )}

      {/* Linha da mensagem — desliza para direita */}
      <div
        className="group flex w-full items-end gap-1"
        style={{
          transform: `translateX(${dragX}px)`,
          transition: snapping ? 'transform 0.2s ease-out' : 'none',
        }}
      >
        {/* Slot esquerdo: checkmark ou botões para mensagens inbound */}
        {active && !isOutbound && (
          <div className="shrink-0 flex items-end pb-1 px-1">
            <CheckCircle2
              className={cn(
                'w-5 h-5 transition-colors',
                isSelected ? 'text-primary fill-primary/20' : 'text-muted-foreground/40'
              )}
            />
          </div>
        )}
        {!active && !isOutbound && (
          <>
            {onReply && (
              <button
                onClick={onReply}
                className="hidden md:inline-flex shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground"
                title="Responder"
                aria-label="Responder mensagem"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
            {onReact && (
              <button
                onClick={(e) => { e.stopPropagation(); openPicker() }}
                className="hidden md:inline-flex shrink-0 p-1 text-muted-foreground transition-opacity md:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-foreground"
                title="Reagir"
                aria-label="Reagir à mensagem"
              >
                <Smile className="w-4 h-4" />
              </button>
            )}
          </>
        )}

        {/* Bolha + picker de reações — ml-auto empurra outbound para direita */}
        {/* max-w aqui (flex item) ancora o percentual ao container, não ao próprio filho */}
        <div className={cn('relative max-w-[85%] sm:max-w-[70%]', isOutbound && 'ml-auto')}>
          {/* Picker de reações — direção calculada ao abrir */}
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
              'relative w-full px-3 py-2 rounded-2xl shadow-sm',
              isOutbound
                ? 'bg-primary text-primary-foreground rounded-tr-none'
                : 'bg-card text-card-foreground border rounded-tl-none',
              // Anel de seleção sobre a bolha (apenas outbound — inbound usa highlight no wrapper)
              isSelected && isOutbound && 'ring-2 ring-primary-foreground/30',
            )}
          >
            {/* Indicador de encaminhamento — igual ao WhatsApp */}
            {message.forwarded && (
              <div className={cn(
                'flex items-center gap-1 mb-1.5 text-[10px] italic',
                isOutbound ? 'opacity-60' : 'opacity-50'
              )}>
                <Forward className="w-3 h-3 shrink-0" />
                <span>Encaminhada</span>
              </div>
            )}

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
            <div className="flex items-center gap-1 mt-1 justify-end">
              <span className="text-[10px] opacity-70">{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Recife' }).format(new Date(message.timestamp))}</span>
              {statusIcon}
            </div>
          </div>

          {/* Badge de reação — aparece abaixo da bolha */}
          {message.reaction && !active && (
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

        {/* Slot direito: checkmark ou botões para mensagens outbound */}
        {active && isOutbound && (
          <div className="shrink-0 flex items-end pb-1 px-1">
            <CheckCircle2
              className={cn(
                'w-5 h-5 transition-colors',
                isSelected ? 'text-primary fill-primary/20' : 'text-muted-foreground/40'
              )}
            />
          </div>
        )}
        {!active && isOutbound && (
          <>
            {onReact && (
              <button
                onClick={(e) => { e.stopPropagation(); openPicker() }}
                className="hidden md:inline-flex shrink-0 p-1 text-muted-foreground transition-opacity md:opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-foreground"
                title="Reagir"
                aria-label="Reagir à mensagem"
              >
                <Smile className="w-4 h-4" />
              </button>
            )}
            {onReply && (
              <button
                onClick={onReply}
                className="hidden md:inline-flex shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-foreground"
                title="Responder"
                aria-label="Responder mensagem"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
