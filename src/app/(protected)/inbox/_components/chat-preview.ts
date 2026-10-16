/**
 * Guarda o contato clicado na lista para o esqueleto do chat (loading.tsx)
 * já exibir nome e iniciais enquanto as mensagens chegam.
 */
export type ChatPreview = { id: string; name: string; initials: string }

let pending: ChatPreview | null = null

export function setPendingChatPreview(preview: ChatPreview) {
  pending = preview
}

export function getPendingChatPreview(): ChatPreview | null {
  return pending
}

/** Chamado quando o chat real monta — evita reaproveitar um preview antigo. */
export function clearPendingChatPreview() {
  pending = null
}
