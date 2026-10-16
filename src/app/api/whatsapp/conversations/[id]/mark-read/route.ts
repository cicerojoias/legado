import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { markAsRead } from '@/lib/whatsapp/meta-client'
import { createServerTiming } from '@/lib/server-timing'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const timing = createServerTiming('api/whatsapp/mark-read')
    const { id: conversationId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 1. Zera o contador do usuário primeiro — o realtime limpa o badge sem esperar a Meta
    // 2. Em paralelo, busca as inbound ainda não lidas
    const [, unreadMessages] = await timing.measure('db', Promise.all([
      prisma.waConversationRead.upsert({
        where: { userId_conversationId: { userId: user.id, conversationId } },
        update: { unreadCount: 0, lastReadAt: new Date() },
        create: { userId: user.id, conversationId, unreadCount: 0 },
      }),
      prisma.waMessage.findMany({
        where: {
          conversation_id: conversationId,
          direction: 'inbound',
          status: { not: 'read' },
        },
        orderBy: { timestamp: 'desc' },
        select: { id: true, wa_message_id: true },
      }),
    ]))

    if (unreadMessages.length > 0) {
      // 3. Na Meta basta marcar a mais recente: as anteriores da conversa também ficam lidas
      const latestWithWaId = unreadMessages.find((msg) => msg.wa_message_id)
      try {
        if (latestWithWaId) await timing.measure('meta', markAsRead(latestWithWaId.wa_message_id!))
        await timing.measure('update', prisma.waMessage.updateMany({
          where: { id: { in: unreadMessages.map((msg) => msg.id) } },
          data: { status: 'read' },
        }))
      } catch (err) {
        console.error(`[mark-read] Falha ao marcar mensagens da conversa ${conversationId}:`, err)
      }
    }

    return NextResponse.json(
      { ok: true, marked: unreadMessages.length },
      { headers: { 'Server-Timing': timing.header() } }
    )
  } catch (err) {
    console.error('[mark-read] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
