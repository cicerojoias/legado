import type { WaConversation, WaContact, WaMessage, WaTag, ConversationTag } from '@prisma/client'

export type TagWithMeta = ConversationTag & {
  tag: WaTag
}

export type ConversationWithPreview = WaConversation & {
  contact:           WaContact
  messages:          WaMessage[]
  unreadCount:       number
  conversation_tags: TagWithMeta[]
}

export type ConversationWithMessages = WaConversation & {
  contact:  WaContact
  messages: WaMessage[]
}
