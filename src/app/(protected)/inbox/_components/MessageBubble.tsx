import { Check, CheckCheck, FileText, Download } from 'lucide-react'
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
}

interface MessageBubbleProps {
  message: WaMessage
}

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

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound'
  
  // Tratamento de Status do WhatsApp
  const StatusIcon = () => {
    if (!isOutbound) return null
    if (message.status === 'delivered') return <CheckCheck className="w-3 h-3 text-muted-foreground" />
    if (message.status === 'read') return <CheckCheck className="w-3 h-3 text-blue-500" />
    if (message.status === 'failed') return <span className="text-[10px] text-destructive font-bold">!</span>
    return <Check className="w-3 h-3 text-muted-foreground" />
  }

  return (
    <div
      className={cn(
        'group flex w-full mb-2',
        isOutbound ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'relative max-w-[85%] sm:max-w-[70%] px-3 py-2 rounded-2xl shadow-sm transition-all',
          isOutbound
            ? 'bg-primary text-primary-foreground rounded-tr-none'
            : 'bg-card text-card-foreground border rounded-tl-none'
        )}
      >
        {/* Renderiza Mídia se houver */}
        <MediaBody message={message} isOutbound={isOutbound} />

        {/* Texto da Mensagem (se não for legenda de imagem já renderizada) */}
        {message.content && message.type === 'text' && (
          <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        )}

        {/* Rodapé: Hora e Status */}
        <div
          className={cn(
            'flex items-center gap-1 mt-1 text-[10px] opacity-70 justify-end'
          )}
        >
          <span>{new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.timestamp))}</span>
          <StatusIcon />
        </div>
      </div>
    </div>
  )
}
