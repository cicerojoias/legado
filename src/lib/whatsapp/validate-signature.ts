import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Valida a assinatura HMAC-SHA256 enviada pela Meta em cada webhook.
 * Sem isso, qualquer um poderia enviar mensagens falsas para o inbox.
 *
 * Sem META_APP_SECRET: recusa em produção; só deixa passar em desenvolvimento.
 *
 * @param rawBody   - body da requisição como string (sem parse)
 * @param signature - valor do header X-Hub-Signature-256
 */
export function validateSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[webhook] META_APP_SECRET não configurado — webhook recusado')
      return false
    }
    console.warn('[webhook] META_APP_SECRET não configurado — validação ignorada em desenvolvimento')
    return true
  }

  if (!signature?.startsWith('sha256=')) return false

  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
  const recebida = Buffer.from(signature.slice('sha256='.length), 'hex')

  return recebida.length === expected.length && timingSafeEqual(expected, recebida)
}
