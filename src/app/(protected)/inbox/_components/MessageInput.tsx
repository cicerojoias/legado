'use client'

import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import { Send, Paperclip, Mic, MicOff, X, FileText, Image } from 'lucide-react'
import { toast } from 'sonner'

interface ReplyContext {
  id: string
  content: string
  direction: string
}

interface MessageInputProps {
  conversationId: string
  onMessageSent?: () => void
  replyTo?: ReplyContext | null
  onClearReply?: () => void
}

// Tipos MIME aceitos no seletor de arquivo
const ACCEPTED_MIME = 'image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,video/mp4,application/pdf'
const MAX_FILE_SIZE_MB = 16 // WhatsApp Cloud API limita a 16MB por envio

type UploadState = 'idle' | 'uploading' | 'preview'

interface MediaPreview {
  url: string       // URL pública no Supabase (depois do upload)
  mimeType: string
  fileName: string
}

export function MessageInput({ conversationId, onMessageSent, replyTo, onClearReply }: MessageInputProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  // Upload de arquivo
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Gravação de áudio
  const [recording, setRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize do textarea
  useLayoutEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      const newHeight = Math.min(el.scrollHeight + 2, 140)
      el.style.height = `${newHeight}px`
      el.style.overflowY = el.scrollHeight > 140 ? 'auto' : 'hidden'
    }
  }, [text])

  // ── Upload de arquivo para Supabase via signed URL ─────────────────────────
  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!e.target) return
    // Reset para permitir selecionar o mesmo arquivo novamente
    ;(e.target as HTMLInputElement).value = ''
    if (!file) return

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Arquivo muito grande. O limite é ${MAX_FILE_SIZE_MB}MB.`)
      return
    }

    setUploadState('uploading')
    try {
      // 1. Pedir Signed URL de upload ao nosso backend
      const sigRes = await fetch('/api/storage/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: file.type, fileName: file.name }),
      })
      if (!sigRes.ok) {
        const { error } = await sigRes.json().catch(() => ({}))
        throw new Error(error ?? 'Não foi possível iniciar o envio.')
      }
      const { uploadUrl, publicUrl } = (await sigRes.json()) as { uploadUrl: string; publicUrl: string }

      // 2. Upload direto para o Supabase (sem passar pelo nosso servidor)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error('Falha ao carregar o arquivo. Verifique sua conexão.')

      setMediaPreview({ url: publicUrl, mimeType: file.type, fileName: file.name })
      setUploadState('preview')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erro ao fazer upload do arquivo.')
      setUploadState('idle')
    }
  }

  // ── Cancelar preview de mídia ──────────────────────────────────────────────
  function cancelMedia() {
    setMediaPreview(null)
    setUploadState('idle')
  }

  // ── Gravação de áudio via MediaRecorder API ────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Ordem de preferência:
      //   1. ogg/opus — Firefox: grava OGG nativo, zero conversão necessária
      //   2. webm/opus — Chrome: grava WebM válido com Opus, converte para OGG
      //   3. mp4 — Safari/iOS último: Chrome Android reporta suporte mas grava conteúdo inválido
      const preferredMimes = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/mp4']
      const selectedMime = preferredMimes.find((m) => MediaRecorder.isTypeSupported(m)) ?? 'audio/webm'
      const recorder = new MediaRecorder(stream, { mimeType: selectedMime })
      audioChunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      recorder.start(200) // coleta chunks a cada 200ms
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRecordSeconds(0)
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000)
    } catch {
      toast.error('Permissão de microfone negada')
    }
  }, [])

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (!recorder) return
    if (timerRef.current) clearInterval(timerRef.current)

    recorder.onstop = async () => {
      // Normalizar: remove parâmetros de codec (ex: "audio/ogg;codecs=opus" → "audio/ogg")
      const rawMime = recorder.mimeType || 'audio/webm'
      const baseMime = rawMime.split(';')[0].trim()

      // Parar todas as tracks do stream para liberar o microfone
      recorder.stream.getTracks().forEach((t) => t.stop())

      setUploadState('uploading')
      setRecording(false)

      try {
        let finalBlob = new Blob(audioChunksRef.current, { type: baseMime })
        let finalMime = baseMime

        // Detectar se o blob gravado precisa de conversão para OGG Opus.
        //
        // Problema: Chrome Android declara suporte a "audio/mp4" via isTypeSupported()
        // mas o arquivo gravado não é um MP4 válido — Meta rejeita com código 131053.
        // Solução: verificar magic bytes reais do blob antes de decidir o fluxo.
        //
        // OGG Opus nativo (Firefox): primeiros 4 bytes = "OggS" (0x4F 0x67 0x67 0x53) → OK sem converter
        // MP4 válido (Safari):        bytes 4-7 = "ftyp" (0x66 0x74 0x79 0x70) → OK sem converter
        // Qualquer outra coisa:       converter para OGG Opus via WebCodecs
        const header = new Uint8Array(await finalBlob.slice(0, 8).arrayBuffer())
        const isNativeOgg = header[0] === 0x4F && header[1] === 0x67 && header[2] === 0x67 && header[3] === 0x53
        const isValidMp4 = header[4] === 0x66 && header[5] === 0x74 && header[6] === 0x79 && header[7] === 0x70
        const needsConversion = !isNativeOgg && !isValidMp4

        if (needsConversion) {
          const { convertToOggOpus, isAudioConversionSupported } = await import('@/lib/audio-converter')
          if (!isAudioConversionSupported()) {
            throw new Error('Este navegador não suporta gravação de áudio. Use o aplicativo WhatsApp para enviar áudios.')
          }
          finalBlob = await convertToOggOpus(finalBlob)
          finalMime = 'audio/ogg'

          // Validar que o OGG produzido tem magic bytes corretos ("OggS")
          const outHeader = new Uint8Array(await finalBlob.slice(0, 4).arrayBuffer())
          const isValidOgg = outHeader[0] === 0x4F && outHeader[1] === 0x67 && outHeader[2] === 0x67 && outHeader[3] === 0x53
          if (!isValidOgg || finalBlob.size < 200) {
            throw new Error('Falha ao converter áudio. Tente gravar novamente.')
          }
        } else if (isNativeOgg) {
          finalMime = 'audio/ogg'
        }

        const ext = finalMime.includes('mp4') ? 'mp4' : finalMime.includes('ogg') ? 'ogg' : 'webm'
        const fileName = `audio-${Date.now()}.${ext}`
        const file = new File([finalBlob], fileName, { type: finalMime })

        const sigRes = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mimeType: finalMime, fileName }),
        })
        if (!sigRes.ok) {
          const { error } = await sigRes.json().catch(() => ({}))
          throw new Error(error ?? 'Não foi possível iniciar o envio do áudio.')
        }
        const { uploadUrl, publicUrl } = (await sigRes.json()) as { uploadUrl: string; publicUrl: string }

        const putRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': finalMime },
          body: file,
        })
        if (!putRes.ok) throw new Error('Falha ao carregar o áudio. Verifique sua conexão.')

        setMediaPreview({ url: publicUrl, mimeType: finalMime, fileName })
        setUploadState('preview')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao processar áudio gravado.')
        setUploadState('idle')
      }
    }
    recorder.stop()
  }, [])

  // ── Envio (texto ou mídia) ─────────────────────────────────────────────────
  async function handleSend() {
    if (sending) return

    // Se há mídia em preview, enviar como mensagem de mídia
    if (mediaPreview && uploadState === 'preview') {
      setSending(true)
      try {
        const res = await fetch('/api/whatsapp/send-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationId,
            mediaUrl: mediaPreview.url,
            mimeType: mediaPreview.mimeType,
            caption: text.trim() || undefined,
          }),
        })
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({}))
          throw new Error(error ?? 'Erro ao enviar mídia.')
        }
        cancelMedia()
        setText('')
        onMessageSent?.()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Erro ao enviar mídia.')
      } finally {
        setSending(false)
      }
      return
    }

    // Caso contrário, enviar texto
    const trimmed = text.trim()
    if (!trimmed) return
    setSending(true)
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          text: trimmed,
          replyToId: replyTo?.id,
          replyToSnapshot: replyTo ? replyTo.content.slice(0, 500) : undefined,
        }),
      })
      if (!res.ok) throw new Error('Falha ao enviar')
      setText('')
      onClearReply?.()
      onMessageSent?.()
    } catch {
      toast.error('Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = !!mediaPreview || !!text.trim()
  const isUploading = uploadState === 'uploading'

  return (
    <div className="border-t bg-background">
      {/* Barra de citação (reply) */}
      {replyTo && (
        <div className="flex items-start gap-2 px-4 pt-2 pb-1">
          <div className="flex-1 rounded-xl bg-muted/60 border border-l-4 border-l-primary px-3 py-2 min-w-0">
            <p className="text-xs font-semibold text-primary mb-0.5">
              {replyTo.direction === 'inbound' ? 'Cliente' : 'Você'}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-2 break-words">
              {replyTo.content || '[Mídia]'}
            </p>
          </div>
          <button
            onClick={onClearReply}
            className="mt-1 w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors shrink-0"
            aria-label="Cancelar resposta"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Preview da mídia selecionada */}
      {mediaPreview && (
        <div className="flex items-center gap-2 px-4 pt-2 pb-1">
          <div className="flex items-center gap-2 flex-1 rounded-xl bg-muted/60 border px-3 py-2 text-sm">
            {mediaPreview.mimeType.startsWith('image/') ? (
              <>
                <Image className="w-4 h-4 text-blue-500 shrink-0" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mediaPreview.url} alt="preview" className="h-12 w-12 rounded object-cover" />
              </>
            ) : mediaPreview.mimeType.startsWith('audio/') ? (
              <>
                <Mic className="w-4 h-4 text-green-500 shrink-0" />
                <audio controls src={mediaPreview.url} className="h-8 max-w-[200px]" />
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="truncate text-muted-foreground max-w-[180px]">{mediaPreview.fileName}</span>
              </>
            )}
          </div>
          <button
            onClick={cancelMedia}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Barra de gravação de áudio */}
      {recording && (
        <div className="flex items-center gap-3 px-4 pt-2 pb-1">
          <div className="flex items-center gap-2 flex-1 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-600 font-medium">
              Gravando... {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
      )}

      {/* Input principal */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* Input oculto para seleção de arquivo */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MIME}
          className="hidden"
          onChange={handleFileSelected}
        />

        {/* Botão de anexo (clip) */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={recording || isUploading || !!mediaPreview}
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors disabled:opacity-30 cursor-pointer"
          title="Anexar arquivo"
        >
          <Paperclip className="w-[18px] h-[18px]" />
        </button>

        {/* Textarea de texto */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={mediaPreview ? 'Legenda (opcional)...' : 'Mensagem...'}
          rows={1}
          disabled={recording}
          className="flex-1 resize-none rounded-2xl border bg-muted/40 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 max-h-[140px] leading-5 hover:cursor-text [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden disabled:opacity-50"
        />

        {/* Botão de microfone (toggle gravar / parar) */}
        {!canSend && !isUploading && (
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
              recording
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
            title={recording ? 'Parar gravação' : 'Gravar áudio'}
          >
            {recording ? <MicOff className="w-[18px] h-[18px]" /> : <Mic className="w-[18px] h-[18px]" />}
          </button>
        )}

        {/* Botão enviar (aparece quando há texto ou mídia pronta) */}
        {(canSend || isUploading) && (
          <button
            onClick={handleSend}
            disabled={!canSend || sending || isUploading}
            className="shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95 cursor-pointer hover:bg-primary/90"
            title="Enviar"
          >
            {isUploading ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}
