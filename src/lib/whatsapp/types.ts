// Alias para compatibilidade com webhook-parser.ts
export type MetaWebhookPayload = WebhookPayload

export interface ParsedInboundMessage {
  waId: string
  phone: string
  name?: string
  waMessageId: string
  type: string
  content: string
  timestamp: Date
  mediaId?: string
  mimeType?: string
}

export interface ParsedStatusUpdate {
  waMessageId: string
  status: string
}

export interface WhatsAppConfig {
  accessToken: string
  phoneNumberId: string
  businessAccountId: string
  version: string
}

export interface WebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: 'whatsapp'
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts?: Array<{
          profile: { name: string }
          wa_id: string
        }>
        messages?: Array<{
          from: string
          id: string
          timestamp: string
          type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'sticker'
              | 'reaction' | 'location' | 'contacts' | 'order' | 'interactive'
              | 'button' | 'system' | 'unsupported' | 'unknown'
          text?: { body: string }
          image?: { caption?: string; mime_type: string; id: string; sha256: string }
          audio?: { mime_type: string; id: string; voice?: boolean }
          video?: { caption?: string; mime_type: string; id: string; sha256: string }
          document?: { filename?: string; mime_type: string; id: string; sha256: string }
          sticker?: { mime_type: string; id: string; animated?: boolean }
          reaction?: { message_id: string; emoji: string }
          location?: { latitude: number; longitude: number; name?: string; address?: string; url?: string }
          contacts?: Array<{
            name?: { formatted_name?: string; first_name?: string }
            phones?: Array<{ phone?: string; type?: string }>
          }>
          order?: {
            catalog_id?: string
            text?: string
            product_items?: Array<{
              product_retailer_id: string
              quantity: number
              item_price: number
              currency: string
            }>
          }
          interactive?: {
            type?: string
            button_reply?: { id?: string; title?: string }
            list_reply?: { id?: string; title?: string; description?: string }
            nfm_reply?: { body?: string; name?: string }
          }
          button?: { text?: string; payload?: string }
          system?: { body?: string; type?: string }
          errors?: Array<{ code: number; title: string; message?: string }>
          context?: { from: string; id: string }
        }>
        statuses?: Array<{
          id: string
          status: 'sent' | 'delivered' | 'read' | 'failed' | 'deleted'
          timestamp: string
          recipient_id: string
          errors?: Array<{
            code: number
            title: string
            message?: string
            error_data?: { details: string }
          }>
        }>
      }
      field: 'messages'
    }>
  }>
}
