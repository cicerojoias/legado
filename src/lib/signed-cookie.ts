import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Cookies assinados (HMAC-SHA256) verificáveis no proxy sem ir ao banco.
 *
 * Formato do valor: `<parte1>.<parte2>...<expUnix>.<assinatura>`.
 * Qualquer alteração no valor invalida a assinatura; o cookie é então ignorado.
 * A chave é derivada do SUPABASE_SERVICE_ROLE_KEY (segredo só do servidor).
 */

export const PIN_COOKIE_MAX_AGE = 60 * 60 * 12 // 12h — depois pede o PIN de novo
export const ROLE_COOKIE_MAX_AGE = 60 * 10 // 10 min — depois relê a role no banco
export const ROLE_COOKIE_NAME = 'legado_role'

export function pinCookieName(userId: string) {
  return `pin_verified_${userId}`
}

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('SUPABASE_SERVICE_ROLE_KEY ausente — necessário para assinar cookies')
  cachedKey = createHmac('sha256', secret).update('legado-signed-cookie-v1').digest()
  return cachedKey
}

function sign(payload: string) {
  return createHmac('sha256', getKey()).update(payload).digest('base64url')
}

function createSignedValue(parts: string[], ttlSeconds: number) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const payload = [...parts, String(exp)].join('.')
  return `${payload}.${sign(payload)}`
}

/** Retorna as partes (sem exp) se assinatura e validade conferem; senão null. */
function readSignedValue(value: string | undefined): string[] | null {
  if (!value) return null
  const dot = value.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = value.slice(0, dot)
  const given = Buffer.from(value.slice(dot + 1))

  let expected: Buffer
  try {
    expected = Buffer.from(sign(payload))
  } catch {
    return null
  }
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null

  const parts = payload.split('.')
  const exp = Number(parts.pop())
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return null
  return parts
}

// ── PIN ───────────────────────────────────────────────────────────────────────

export function createPinCookieValue(userId: string) {
  return createSignedValue([userId], PIN_COOKIE_MAX_AGE)
}

export function isPinCookieValid(value: string | undefined, userId: string) {
  const parts = readSignedValue(value)
  return parts !== null && parts[0] === userId
}

// ── Role ──────────────────────────────────────────────────────────────────────

export function createRoleCookieValue(userId: string, role: string) {
  return createSignedValue([userId, role], ROLE_COOKIE_MAX_AGE)
}

export function readRoleCookie(value: string | undefined, userId: string): string | null {
  const parts = readSignedValue(value)
  if (!parts || parts[0] !== userId || !parts[1]) return null
  return parts[1]
}
