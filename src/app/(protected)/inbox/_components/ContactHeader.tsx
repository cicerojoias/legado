'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle, Eraser, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { WaContact, WaConversation } from '@prisma/client'
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

interface ContactHeaderProps {
  contact: WaContact
  conversation: WaConversation
  showBackButton?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  resolved: 'Resolvida',
  waiting: 'Aguardando',
}

export function ContactHeader({ contact, conversation, showBackButton }: ContactHeaderProps) {
  const router = useRouter()
  const [resolving, setResolving] = useState(false)
  const [status, setStatus] = useState(conversation.status)
  
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'clear' | 'delete' | null>(null)

  async function handleResolve() {
    setResolving(true)
    try {
      const res = await fetch(`/api/whatsapp/conversations/${conversation.id}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error()
      setStatus('resolved')
      toast.success('Conversa marcada como resolvida')
      router.refresh()
    } catch {
      toast.error('Erro ao resolver conversa')
    } finally {
      setResolving(false)
    }
  }

  async function handleConfirmDelete() {
    if (!dialogType) return
    setResolving(true)
    try {
      const res = await fetch(`/api/whatsapp/conversations/${conversation.id}?action=${dialogType}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error()
      
      if (dialogType === 'delete') {
         toast.success('Conversa excluída com sucesso')
         router.push('/inbox')
      } else {
         toast.success('Mensagens apagadas com sucesso')
         router.refresh()
      }
    } catch {
      toast.error('Erro ao realizar a operação')
    } finally {
      setResolving(false)
      setDialogOpen(false)
    }
  }

  const initials = (contact.name ?? contact.phone)
    .split(' ')
    .slice(0, 2)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()

  return (
    <>
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b bg-card">
        {/* Botão voltar — só no mobile */}
        {showBackButton && (
          <button
            onClick={() => router.back()}
            className="md:hidden p-1 -ml-1 text-muted-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">
            {contact.name ?? contact.phone}
          </p>
          <p className="text-xs text-muted-foreground">
            {contact.name ? contact.phone : ''}
          </p>
        </div>

        {/* Badge de status */}
        <span
          className={cn(
            'text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline-flex',
            status === 'open' && 'bg-green-500/10 text-green-600',
            status === 'resolved' && 'bg-muted text-muted-foreground',
            status === 'waiting' && 'bg-yellow-500/10 text-yellow-600',
          )}
        >
          {STATUS_LABELS[status] ?? status}
        </span>

        {/* Ações */}
        <div className="flex items-center gap-1">
          {status === 'open' && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="p-1.5 text-green-600 hover:bg-green-500/10 hover:text-green-700 rounded-lg transition-colors disabled:opacity-40"
              title="Marcar como resolvida"
            >
              <CheckCircle className="w-5 h-5" />
            </button>
          )}

          <button
            onClick={() => { setDialogType('clear'); setDialogOpen(true) }}
            disabled={resolving}
            className="p-1.5 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 rounded-lg transition-colors disabled:opacity-40"
            title="Limpar mensagens (Apenas Limpar)"
          >
            <Eraser className="w-5 h-5" />
          </button>

          <button
            onClick={() => { setDialogType('delete'); setDialogOpen(true) }}
            disabled={resolving}
            className="p-1.5 text-red-600 hover:bg-red-500/10 hover:text-red-700 rounded-lg transition-colors disabled:opacity-40"
            title="Excluir conversa (Apagar Tudo)"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialogType === 'delete' ? 'Excluir conversa inteira?' : 'Limpar apenas mensagens?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialogType === 'delete' 
                ? 'Esta ação apagará a conversa inteira e TODAS as suas mensagens do seu painel e do banco de dados. O contato não será avisado, mas o histórico sumirá para você. Essa operação não pode ser desfeita.'
                : 'Esta ação apagará apenas o histórico de mensagens desta conversa do seu painel. A conversa em si continuará aberta na lista. Essa operação não pode ser desfeita.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resolving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              variant="destructive" 
              onClick={(e) => {
                e.preventDefault()
                handleConfirmDelete()
              }}
              disabled={resolving}
            >
              Sim, {dialogType === 'delete' ? 'Excluir Chat' : 'Limpar Mensagens'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
