import { ChatSkeleton } from '../_components/ChatSkeleton'

// Exibido instantaneamente ao clicar numa conversa (e pré-carregado pelo <Link>),
// enquanto as mensagens chegam do servidor — mesmo comportamento do WhatsApp nativo.
export default function ConversationLoading() {
  return <ChatSkeleton />
}
