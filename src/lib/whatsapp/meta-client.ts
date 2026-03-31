import { getWhatsAppMediaType } from './mime-utils'

const BASE_URL = 'https://graph.facebook.com/v22.0'

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
 * @param contextWaMessageId - wa_message_id da mensagem citada (reply). Deve ser o ID
 *   retornado pela Meta (formato wamid.xxx), não o ID interno do banco.
 * @returns o wa_message_id retornado pela Meta
 */
export async function sendTextMessage(
  to: string,
  text: string,
  contextWaMessageId?: string
): Promise<string> {
  const phoneId = getPhoneId()
  const token = getToken()

  const payload: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  }

  if (contextWaMessageId) {
    payload.context = { message_id: contextWaMessageId }
  }

  const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
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

/**
 * Envia uma mensagem de mídia via link público (Supabase Storage).
 * A Meta baixa e hospeda internamente — o link do Supabase não fica exposto ao cliente final.
 * @returns wa_message_id retornado pela Meta
 */
export async function sendMediaMessage(
  to: string,
  mediaUrl: string,
  mimeType: string,
  caption?: string
): Promise<string> {
  const phoneId = getPhoneId()
  const token = getToken()

  // Determinar o tipo de mensagem de mídia com base no MIME
  const waType = getWhatsAppMediaType(mimeType)

  // Montar o payload de mídia com link (hosted externally)
  const mediaPayload = {
    link: mediaUrl,
    ...(caption && waType !== 'audio' ? { caption } : {}), // áudio não aceita caption
  }

  const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: waType,
      [waType]: mediaPayload,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta Media send error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as { messages: Array<{ id: string }> }
  return data.messages[0]?.id ?? ''
}

/**
 * Faz upload de um buffer binário para a Meta Media API e retorna o media_id.
 * O media_id expira após ~30 dias — deve ser usado imediatamente para envio.
 * Endpoint: POST /{phone-id}/media (multipart/form-data)
 *
 * @param buffer      - Conteúdo binário do arquivo
 * @param mimeType    - MIME type já validado (ex: "image/jpeg", "audio/ogg")
 * @param fileName    - Nome do arquivo para o campo do form (ex: "foto.jpg")
 * @returns           - media_id retornado pela Meta
 */
export async function uploadMediaToMeta(
  buffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<string> {
  const phoneId = getPhoneId()
  const token = getToken()

  // FormData + Blob são globais no Node 18+ (Next.js 15 ✓)
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mimeType)
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), fileName)

  const res = await fetch(`${BASE_URL}/${phoneId}/media`, {
    method: 'POST',
    headers: {
      // NÃO setar Content-Type manualmente — o fetch define o boundary do multipart automaticamente
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta Media upload error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as { id: string }
  if (!data.id) throw new Error('Meta não retornou media_id após upload')

  return data.id
}

/**
 * Envia uma mensagem de mídia usando um media_id previamente carregado na Meta.
 * Preferível ao envio por link público — elimina dependência de URL acessível externamente.
 *
 * @param to        - Número do destinatário (formato E.164 sem +)
 * @param mediaId   - ID retornado por uploadMediaToMeta()
 * @param mimeType  - MIME type para determinar o waType
 * @param caption   - Legenda opcional (não suportada em áudio)
 * @returns         - wa_message_id retornado pela Meta
 */
export async function sendMediaByMediaId(
  to: string,
  mediaId: string,
  mimeType: string,
  caption?: string
): Promise<string> {
  const phoneId = getPhoneId()
  const token = getToken()

  const waType = getWhatsAppMediaType(mimeType)

  const mediaPayload = {
    id: mediaId,
    ...(caption && waType !== 'audio' ? { caption } : {}),
  }

  const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: waType,
      [waType]: mediaPayload,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta Media send-by-id error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as { messages: Array<{ id: string }> }
  return data.messages[0]?.id ?? ''
}

/**
 * Envia uma mensagem de template pré-aprovado pela Meta.
 * Necessário para contatos fora da janela de 24h.
 *
 * @param to           - Número do destinatário (formato E.164 sem +)
 * @param templateName - Nome exato do template no Meta Business Manager
 * @param languageCode - Código de idioma (ex: "pt_BR")
 * @param bodyParams   - Valores das variáveis {{1}}, {{2}}... do corpo do template
 * @returns            - wa_message_id retornado pela Meta
 */
export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[] = []
): Promise<string> {
  const phoneId = getPhoneId()
  const token = getToken()

  const components =
    bodyParams.length > 0
      ? [
          {
            type: 'body',
            parameters: bodyParams.map((text) => ({ type: 'text', text })),
          },
        ]
      : []

  const res = await fetch(`${BASE_URL}/${phoneId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        ...(components.length > 0 ? { components } : {}),
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Meta Template error ${res.status}: ${err}`)
  }

  const data = (await res.json()) as { messages: Array<{ id: string }> }
  return data.messages[0]?.id ?? ''
}

/**
 * Envia ou remove uma reação a uma mensagem.
 * Para remover, passe emoji como string vazia "".
 *
 * @param to          - Número do destinatário (formato E.164 sem +)
 * @param waMessageId - ID da mensagem na Meta (wamid.xxx)
 * @param emoji       - Emoji da reação. "" remove a reação existente.
 */
export async function sendReaction(
  to: string,
  waMessageId: string,
  emoji: string
): Promise<void> {
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
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: { message_id: waMessageId, emoji },
    }),
  })
}

/**
 * Baixa o binário de uma mídia da Meta em dois passos:
 * 1. Resolve o URL de download usando o media_id
 * 2. Faz o GET autenticado para baixar o buffer
 * @returns Buffer com o conteúdo binário
 */
export async function downloadMediaBuffer(mediaId: string): Promise<Buffer> {
  const token = getToken()

  // Passo 1: Obter o URL de download (expira em ~5 min)
  const metaRes = await fetch(`${BASE_URL}/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!metaRes.ok) {
    const err = await metaRes.text()
    throw new Error(`Meta Media URL error ${metaRes.status}: ${err}`)
  }

  const { url } = (await metaRes.json()) as { url: string }

  // Passo 2: Baixar o binário com autenticação
  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!mediaRes.ok) {
    throw new Error(`Falha ao baixar mídia: ${mediaRes.status}`)
  }

  const arrayBuffer = await mediaRes.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
