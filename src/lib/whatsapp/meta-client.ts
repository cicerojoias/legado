const BASE_URL = 'https://graph.facebook.com/v19.0'

function getPhoneId(): string {
  const id = process.env.WHATSAPP_PHONE_ID
  if (!id) throw new Error('WHATSAPP_PHONE_ID não configurado')
  return id
}

function getToken(): string {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) throw new Error('WHATSAPP_TOKEN não configurado')
  return token
}

/**
 * Envia uma mensagem de texto para um destinatário.
 * @returns o wa_message_id retornado pela Meta
 */
export async function sendTextMessage(to: string, text: string): Promise<string> {
  const phoneId = getPhoneId()
  const token = getToken()

  const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta API error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as { messages: Array<{ id: string }> }
  return data.messages[0]?.id ?? ''
}

/**
 * Marca uma mensagem como "lida" (double check azul no WhatsApp do cliente).
 */
export async function markAsRead(waMessageId: string): Promise<void> {
  const phoneId = getPhoneId()
  const token = getToken()

  await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: waMessageId,
    }),
  })
}
