'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Eraser, Trash2, Receipt, Bot } from 'lucide-react'
import { toast } from 'sonner'
import { useState } from 'react'
import { toggleIaAtiva } from '../actions/conversation'
import { cn } from '@/lib/utils'
import type { WaContact, WaConversation, WaTag } from '@prisma/client'
import type { TagWithMeta } from './types'
import { ConversationTagPanel } from './ConversationTagPanel'
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
import { useSelectionState } from './SelectionContext'
import { SelectionHeaderOverlay } from './SelectionHeaderOverlay'
import { OrcamentoModal } from './OrcamentoModal'
import { useInsertText } from './InsertTextContext'

interface ContactHeaderProps {
  contact:       WaContact
  conversation:  WaConversation
  showBackButton?: boolean
  currentTags?:  TagWithMeta[]
  availableTags?: WaTag[]
}

export function ContactHeader({ contact, conversation, showBackButton, currentTags = [], availableTags = [] }: ContactHeaderProps) {
  const router = useRouter()
  const [resolving, setResolving] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<'clear' | 'delete' | null>(null)
  const [orcamentoOpen, setOrcamentoOpen] = useState(false)
  const [iaAtiva, setIaAtiva] = useState(conversation.ia_ativa)
  const [togglingIa, setTogglingIa] = useState(false)

  const { active } = useSelectionState()
  const { requestInsert } = useInsertText()

  async function handleToggleIa() {
    setTogglingIa(true)
    setIaAtiva((prev) => !prev) // otimista
    const result = await toggleIaAtiva(conversation.id)
    if (result.success) {
      toast.success(result.ia_ativa ? 'IA ativada nesta conversa' : 'IA desativada')
      setIaAtiva(result.ia_ativa)
    } else {
      setIaAtiva((prev) => !prev) // reverter
      toast.error('Erro ao alterar IA')
    }
    setTogglingIa(false)
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

  // Modo seleção: renderiza overlay no lugar do header normal
  if (active) {
    return (
      <SelectionHeaderOverlay
        contactName={contact.name ?? contact.phone}
        conversationId={conversation.id}
      />
    )
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-card shrink-0">
        {/* Botão voltar — só no mobile */}
        {showBackButton && (
          <button
            onClick={() => {
              if (window.history.length <= 1) {
                router.push('/inbox')
              } else {
                router.back()
              }
            }}
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
          {availableTags.length > 0 && (
            <ConversationTagPanel
              conversationId={conversation.id}
              currentTags={currentTags}
              availableTags={availableTags}
            />
          )}
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1">
          {/* Toggle IA */}
          <button
            onClick={handleToggleIa}
            disabled={togglingIa}
            className={cn(
              'p-1.5 rounded-lg transition-colors disabled:opacity-40',
              iaAtiva
                ? 'text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20'
                : 'text-muted-foreground hover:bg-muted'
            )}
            title={iaAtiva ? 'IA ativa — clique para desativar' : 'Ativar resposta automática com IA'}
          >
            <Bot className="w-5 h-5" />
          </button>

          {/* Orçamento — abre modal de preset de mensagem */}
          <button
            onClick={() => setOrcamentoOpen(true)}
            className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="Criar orçamento"
          >
            <Receipt className="w-5 h-5" />
          </button>

          <button
            onClick={() => { setDialogType('clear'); setDialogOpen(true) }}
            disabled={resolving}
            className="p-1.5 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 rounded-lg transition-colors disabled:opacity-40"
            title="Limpar mensagens"
          >
            <Eraser className="w-5 h-5" />
          </button>

          <button
            onClick={() => { setDialogType('delete'); setDialogOpen(true) }}
            disabled={resolving}
            className="p-1.5 text-red-600 hover:bg-red-500/10 hover:text-red-700 rounded-lg transition-colors disabled:opacity-40"
            title="Excluir conversa"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <OrcamentoModal
        open={orcamentoOpen}
        onClose={() => setOrcamentoOpen(false)}
        onInsert={(text) => { requestInsert(text); setOrcamentoOpen(false) }}
      />

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
