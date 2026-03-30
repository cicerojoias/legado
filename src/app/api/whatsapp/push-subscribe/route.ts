import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

// ─── SSRF allowlist ───────────────────────────────────────────────────────────
// Only known push service domains are accepted as subscription endpoints.
// This prevents an attacker from using this endpoint as an SSRF vector to make
// the server dispatch HTTP requests to arbitrary internal/external hosts.
const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',         // Chrome / Android
  'updates.push.services.mozilla.com', // Firefox
  'notify.windows.com',         // Edge / Windows
  'push.apple.com',             // Safari / iOS PWA
]

// ─── Zod schema ───────────────────────────────────────────────────────────────
const SubscribeSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(512)
    .refine((url) => {
      try {
        const { hostname } = new URL(url)
        return ALLOWED_PUSH_HOSTS.some(
          (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
        )
      } catch {
        return false
      }
    }, 'Endpoint de push não permitido'),
  p256dh: z.string().min(1).max(100),
  auth: z.string().min(1).max(50),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, role: true, ativo: true },
  })
  if (!dbUser || !dbUser.ativo) return null

  return dbUser
}

// ─── POST /api/whatsapp/push-subscribe ────────────────────────────────────────
// Upserts a push subscription for the authenticated ADMIN/SUPER_ADMIN user.

export async function POST(req: NextRequest) {
  const dbUser = await getAuthenticatedUser()
  if (!dbUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // RBAC: only ADMIN and SUPER_ADMIN receive WAB push notifications
  if (dbUser.role === 'OPERADOR') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
  }

  // Rate limit: 10 subscriptions / 15 min per user (device registrations, not high frequency)
  const rl = rateLimit(`push-subscribe:${dbUser.id}`, 10, 15)
  if (!rl.success) {
    return NextResponse.json({ error: rl.message }, { status: 429 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = SubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten().fieldErrors },
      { status: 400 }
    )
  }

  const { endpoint, p256dh, auth } = parsed.data

  // Upsert: if endpoint already stored (same device re-subscribing), update keys.
  // If a different user tries to claim an existing endpoint, endpoint @unique will
  // reject silently through conflict handling — they keep their own subscription.
  await prisma.waPushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth, userId: dbUser.id },
    create: { endpoint, p256dh, auth, userId: dbUser.id },
  })

  return NextResponse.json({ success: true })
}

// ─── DELETE /api/whatsapp/push-subscribe ──────────────────────────────────────
// Removes a specific subscription by endpoint (sent in body).

export async function DELETE(req: NextRequest) {
  const dbUser = await getAuthenticatedUser()
  if (!dbUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let endpoint: string | undefined
  try {
    const body = await req.json()
    endpoint = typeof body?.endpoint === 'string' ? body.endpoint : undefined
  } catch {
    // body parse failed — fall through to delete all for user
  }

  if (endpoint) {
    await prisma.waPushSubscription.deleteMany({
      where: { endpoint, userId: dbUser.id },
    })
  } else {
    // No endpoint provided — unsubscribe all devices for this user (e.g. logout)
    await prisma.waPushSubscription.deleteMany({
      where: { userId: dbUser.id },
    })
  }

  return NextResponse.json({ success: true })
}
