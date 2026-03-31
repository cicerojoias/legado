import type { WaConversation, WaContact, WaMessage } from '@prisma/client'

export type ConversationWithPreview = WaConversation & {
  contact: WaContact
  messages: WaMessage[]
  unreadCount: number
}

export type ConversationWithMessages = WaConversation & {
  contact: WaContact
  messages: WaMessage[]
}
