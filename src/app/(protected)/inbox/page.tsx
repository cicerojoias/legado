import { MessageCircle } from 'lucide-react'

export const metadata = { title: 'Inbox — Legado' }

// Lista e sidebar vivem no layout; aqui fica só o placeholder da coluna de chat (desktop).
export default function InboxPage() {
  return (
    <div className="flex flex-1 items-center justify-center text-muted-foreground">
      <div className="text-center space-y-2">
        <MessageCircle className="w-12 h-12 mx-auto opacity-20" />
        <p className="text-sm">Selecione uma conversa</p>
      </div>
    </div>
  )
}
