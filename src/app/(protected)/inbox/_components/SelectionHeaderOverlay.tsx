'use client'

import { useState } from 'react'
import { X, Copy, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSelectionState, useSelectionActions } from './SelectionContext'

interface SelectionHeaderOverlayProps {
  /** Nome do contato — exibido como remetente nas mensagens copiadas */
  contactName: string
  /** ID da conversa — necessário para o endpoint de deleção (Fase 4) */
  conversationId: string
}

export function SelectionHeaderOverlay({ contactName, conversationId }: SelectionHeaderOverlayProps) {
  const { count, selected, canDelete } = useSelectionState()
  const { clear } = useSelectionActions()

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── Copiar mensagens selecionadas ─────────────────────────────────────────
  const handleCopy = async () => {
    const msgs = [...selected.values()].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    const fmt = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Recife',
    })

    const text = msgs.map((msg) => {
      const time = fmt.format(new Date(msg.timestamp))
      const sender = msg.direction === 'outbound' ? 'Cícero Joias' : contactName
      const body = (() => {
        if (msg.type === 'image') return msg.content ? `[Imagem] ${msg.content}` : '[Imagem]'
        if (msg.type === 'audio') return '[Áudio]'
        if (msg.type === 'video') return msg.content ? `[Vídeo] ${msg.content}` : '[Vídeo]'
        if (msg.type === 'document') return msg.content ? `[Documento] ${msg.content}` : '[Documento]'
        return msg.content ?? '[Mídia]'
      })()
      return `[${time}] ${sender}: ${body}`
    }).join('\n')

    try {
      await navigator.clipboard.writeText(text)
      toast.success(count === 1 ? 'Mensagem copiada' : `${count} mensagens copiadas`)
      clear()
    } catch {
      toast.error('Não foi possível copiar — permissão de área de transferência negada')
    }
  }

  // ── Deletar mensagens selecionadas ────────────────────────────────────────
  const handleConfirmDelete = async () => {
    setDeleting(true)
    try {
      const ids = [...selected.keys()]
      const res = await fetch('/api/whatsapp/messages/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageIds: ids, conversationId }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? 'Erro ao deletar mensagens')
        return
      }

      const data = await res.json()
      const deletedCount: number = data.deleted ?? ids.length
      const skippedCount: number = data.skipped ?? 0

      if (deletedCount > 0) {
        toast.success(
          deletedCount === 1 ? 'Mensagem deletada' : `${deletedCount} mensagens deletadas`
        )
      }
      if (skippedCount > 0) {
        toast.warning(
          `${skippedCount} mensagem${skippedCount > 1 ? 's' : ''} não ${skippedCount > 1 ? 'puderam' : 'pôde'} ser deletada${skippedCount > 1 ? 's' : ''} (janela de 60h expirada)`
        )
      }

      clear()
    } catch {
      toast.error('Erro de rede ao deletar mensagens')
    } finally {
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0 animate-in slide-in-from-top-2 duration-150">
        {/* Botão fechar — sai do modo seleção */}
        <button
          onClick={clear}
          className="p-1 -ml-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Cancelar seleção"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Contagem */}
        <span className="flex-1 font-semibold text-sm">
          {count} {count === 1 ? 'selecionada' : 'selecionadas'}
        </span>

        {/* Ações */}
        <div className="flex items-center gap-1">
          {/* Copiar — sempre disponível */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Copiar mensagens"
            aria-label="Copiar mensagens selecionadas"
          >
            <Copy className="w-5 h-5" />
          </button>

          {/* Deletar — apenas quando canDelete */}
          <button
            onClick={() => setDeleteOpen(true)}
            disabled={!canDelete}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              canDelete
                ? 'text-destructive hover:bg-destructive/10'
                : 'text-muted-foreground/30 cursor-not-allowed'
            )}
            title={
              canDelete
                ? 'Deletar mensagens'
                : 'Só é possível deletar mensagens enviadas por você dentro de 60h'
            }
            aria-label="Deletar mensagens selecionadas"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Dialog de confirmação de deleção */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Deletar {count === 1 ? 'esta mensagem' : `${count} mensagens`}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {count === 1
                ? 'A mensagem será removida para todos na conversa via Meta API. Essa ação não pode ser desfeita.'
                : `As ${count} mensagens serão removidas para todos na conversa via Meta API. Essa ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => { e.preventDefault(); handleConfirmDelete() }}
              disabled={deleting}
            >
              {deleting ? 'Deletando…' : 'Sim, deletar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
