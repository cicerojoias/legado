import { Suspense } from 'react'
import { MessageCircle } from 'lucide-react'
import { ConversationList } from './_components/ConversationList'

export const metadata = { title: 'Inbox — Legado' }
export const dynamic = 'force-dynamic'

// Página principal do inbox.
// Mobile: tela cheia com lista de conversas.
// Desktop: painel esquerdo da UI split-pane (lado direito fica vazio até selecionar).
export default function InboxPage() {
  return (
    <div className="flex h-full">
      {/* Lista de conversas — ocupa tela cheia no mobile, coluna no desktop */}
      <div className="w-full md:w-[360px] md:border-r flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-4 border-b">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h1 className="font-semibold text-lg">WhatsApp</h1>
        </div>

        {/* Lista scrollável */}
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<ConversationListSkeleton />}>
            <ConversationList />
          </Suspense>
        </div>
      </div>

      {/* Coluna de chat — só visível no desktop, vazia até selecionar */}
      <div className="hidden md:flex flex-1 items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <MessageCircle className="w-12 h-12 mx-auto opacity-20" />
          <p className="text-sm">Selecione uma conversa</p>
        </div>
      </div>
    </div>
  )
}

function ConversationListSkeleton() {
  return (
    <div className="space-y-0 divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <div className="w-12 h-12 rounded-full bg-muted animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-muted animate-pulse rounded w-32" />
            <div className="h-3 bg-muted animate-pulse rounded w-48" />
          </div>
        </div>
      ))}
    </div>
  )
}
