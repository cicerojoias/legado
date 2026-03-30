import webpush from 'web-push'
import type { WebPushError } from 'web-push'
import { prisma } from '@/lib/prisma'

function getVapidConfig(): { publicKey: string; privateKey: string; subject: string } {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT

  if (!publicKey || !privateKey || !subject) {
    throw new Error('[push-client] VAPID env vars não configuradas')
  }
  return { publicKey, privateKey, subject }
}

/**
 * Envia uma Web Push notification para um único dispositivo.
 *
 * Tratamento automático de subscriptions expiradas:
 *  - 410 Gone / 404 Not Found → deleta do banco (device desregistrou o SW)
 *  - Outros erros → propaga para o caller lidar com Promise.allSettled
 */
export async function sendPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object
): Promise<void> {
  const { publicKey, privateKey, subject } = getVapidConfig()

  webpush.setVapidDetails(subject, publicKey, privateKey)

  try {
    await webpush.sendNotification(
      { endpoint, keys: { p256dh, auth } },
      JSON.stringify(payload),
      { TTL: 60 } // 60s: se device offline, o push service tenta por 1 min
    )
  } catch (err) {
    const e = err as WebPushError
    if (e.statusCode === 410 || e.statusCode === 404) {
      // Subscription inválida/expirada — limpar silenciosamente
      await prisma.waPushSubscription
        .deleteMany({ where: { endpoint } })
        .catch(() => {})
    } else {
      throw err
    }
  }
}
