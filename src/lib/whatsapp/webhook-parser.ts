import type {
  MetaWebhookPayload,
  ParsedInboundMessage,
  ParsedStatusUpdate,
} from './types'

/**
 * Extrai as mensagens recebidas do payload bruto da Meta.
 * Ignora eventos sem mensagens (ex: status updates) para esse método.
 */
export function parseInboundMessages(payload: MetaWebhookPayload): ParsedInboundMessage[] {
  const messages: ParsedInboundMessage[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const { value } = change
      if (!value.messages?.length) continue

      const contactMap = new Map(
        (value.contacts ?? []).map((c) => [c.wa_id, c.profile.name])
      )

      for (const msg of value.messages) {
        const content =
          msg.type === 'text' ? (msg.text?.body ?? '') : `[${msg.type}]`

        messages.push({
          waId: msg.from,
          phone: msg.from,
          name: contactMap.get(msg.from),
          waMessageId: msg.id,
          type: msg.type,
          content,
          timestamp: new Date(Number(msg.timestamp) * 1000),
        })
      }
    }
  }

  return messages
}

/**
 * Extrai atualizações de status (delivered, read, etc.) do payload.
 */
export function parseStatusUpdates(payload: MetaWebhookPayload): ParsedStatusUpdate[] {
  const updates: ParsedStatusUpdate[] = []

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const status of change.value.statuses ?? []) {
        updates.push({
          waMessageId: status.id,
          status: status.status,
        })
      }
    }
  }

  return updates
}
