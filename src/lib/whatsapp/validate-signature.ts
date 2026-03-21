import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Valida a assinatura HMAC-SHA256 enviada pela Meta em cada webhook.
 * Sem isso, qualquer um poderia enviar dados falsos para o endpoint.
 *
 * @param rawBody  - body da requisição como string (sem parse)
 * @param signature - valor do header X-Hub-Signature-256
 */
export function validateSignature(rawBody: string, signature: string): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    // Em dev sem secret configurado, apenas logar e deixar passar
    console.warn('[webhook] META_APP_SECRET não configurado — ignorando validação de assinatura')
    return true
  }

  if (!signature.startsWith('sha256=')) return false

  const expected = createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')

  const sig = signature.slice('sha256='.length)

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(sig, 'hex'))
  } catch {
    return false
  }
}
