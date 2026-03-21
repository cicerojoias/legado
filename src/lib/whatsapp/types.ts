// ─── Tipos do payload do webhook da Meta ────────────────────────────────────

export interface MetaWebhookPayload {
  object: string
  entry: MetaEntry[]
}

export interface MetaEntry {
  id: string
  changes: MetaChange[]
}

export interface MetaChange {
  value: MetaChangeValue
  field: string
}

export interface MetaChangeValue {
  messaging_product: string
  metadata: { display_phone_number: string; phone_number_id: string }
  contacts?: MetaContact[]
  messages?: MetaInboundMessage[]
  statuses?: MetaStatus[]
}

export interface MetaContact {
  profile: { name: string }
  wa_id: string
}

export interface MetaInboundMessage {
  from: string      // número do remetente, ex: "5583999999999"
  id: string        // wa_message_id
  timestamp: string // unix timestamp em string
  type: string      // "text" | "image" | "audio" | etc.
  text?: { body: string }
}

export interface MetaStatus {
  id: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string
  recipient_id: string
}

// ─── Tipo interno normalizado ────────────────────────────────────────────────

export interface ParsedInboundMessage {
  waId: string       // ID interno da Meta (contato)
  phone: string      // número do remetente
  name: string | undefined
  waMessageId: string
  type: string
  content: string
  timestamp: Date
}

export interface ParsedStatusUpdate {
  waMessageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
}
