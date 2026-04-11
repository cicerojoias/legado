import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const QuerySchema = z.string().min(2).max(100)

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Rate limit: 30 req/min por usuário
    const rl = await rateLimit(`wab-search:${user.id}`, 30, 1)
    if (!rl.success) return NextResponse.json({ error: 'Muitas buscas. Aguarde.' }, { status: 429 })

    const raw = req.nextUrl.searchParams.get('q') ?? ''
    const parsed = QuerySchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json({ contacts: [], messages: [] })
    }
    const q = parsed.data

    // Busca em paralelo: contatos (nome/telefone) + mensagens (conteúdo)
    const [contacts, messages] = await Promise.all([
      prisma.waContact.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q } },
          ],
        },
        include: {
          conversations: { select: { id: true }, take: 1 },
        },
        take: 5,
      }),

      prisma.waMessage.findMany({
        where: { content: { contains: q, mode: 'insensitive' } },
        orderBy: { timestamp: 'desc' },
        include: {
          conversation: { include: { contact: true } },
        },
        take: 10,
      }),
    ])

    return NextResponse.json({ contacts, messages })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
