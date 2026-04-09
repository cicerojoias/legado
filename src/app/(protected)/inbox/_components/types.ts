import type { WaConversation, WaContact, WaMessage, WaTag, ConversationTag, WaConversationNote, User } from '@prisma/client'

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

export type ConversationNoteWithAuthor = WaConversationNote & {
  author: Pick<User, 'id' | 'nome' | 'email'> | null
}
