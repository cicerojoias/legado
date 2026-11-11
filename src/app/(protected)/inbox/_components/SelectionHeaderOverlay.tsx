'use client'

import { useState } from 'react'
import { X, Copy, Info, Forward } from 'lucide-react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useSelectionState, useSelectionActions } from './SelectionContext'
import { ForwardModal } from './ForwardModal'

interface SelectionHeaderOverlayProps {
  /** Nome do contato — exibido como remetente nas mensagens copiadas */
  contactName: string
}

export function SelectionHeaderOverlay({ contactName }: SelectionHeaderOverlayProps) {
  const { count, selected } = useSelectionState()
  const { clear } = useSelectionActions()

  const [deleteInfoOpen, setDeleteInfoOpen] = useState(false)
  const [forwardOpen, setForwardOpen] = useState(false)

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
          {/* Encaminhar — sempre disponível */}
          <button
            onClick={() => setForwardOpen(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Encaminhar mensagens"
            aria-label="Encaminhar mensagens selecionadas"
          >
            <Forward className="w-5 h-5" />
          </button>

          {/* Copiar — sempre disponível */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Copiar mensagens"
            aria-label="Copiar mensagens selecionadas"
          >
            <Copy className="w-5 h-5" />
          </button>

          {/* Explica a limitação sem oferecer uma exclusão indisponível. */}
          <button
            onClick={() => setDeleteInfoOpen(true)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            title="Sobre excluir mensagens"
            aria-label="Sobre excluir mensagens"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal de encaminhamento */}
      <ForwardModal
        open={forwardOpen}
        onClose={() => setForwardOpen(false)}
        messageIds={[...selected.keys()]}
        messageCount={count}
        onForwarded={clear}
      />

      <AlertDialog open={deleteInfoOpen} onOpenChange={setDeleteInfoOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível apagar mensagens enviadas</AlertDialogTitle>
            <AlertDialogDescription>
              A integração com o WhatsApp não permite apagar mensagens já enviadas.
              A mensagem continua na conversa do cliente. Para corrigir alguma informação,
              envie uma nova mensagem. Fora da janela de 24 horas, use um modelo aprovado
              adequado ou aguarde a resposta do cliente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
