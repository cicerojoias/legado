import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/whatsapp/conversations — lista paginada de conversas
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const userId = user.id
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'
  const filter = searchParams.get('filter')
  const tagId = searchParams.get('tag')
  const beforeParam = searchParams.get('before')
  const before = beforeParam ? new Date(beforeParam) : null
  const limit = parseInt(searchParams.get('limit') ?? '50', 10)

  const where = {
    ...(status !== 'all' ? { status } : {}),
    ...(filter === 'unread' ? { conversation_reads: { some: { userId, unreadCount: { gt: 0 } } } } : {}),
    ...(tagId ? { conversation_tags: { some: { tagId } } } : {}),
    ...(before ? { last_message_at: { lt: before } } : {}),
  }

  const rawConversations = await prisma.waConversation.findMany({
    where,
    orderBy: { last_message_at: 'desc' },
    include: {
      contact: true,
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
      conversation_reads: {
        where: { userId },
        take: 1,
      },
      conversation_tags: {
        include: { tag: true },
        orderBy: { assignedAt: 'asc' },
      },
    },
    take: limit,
  })

  const conversations = rawConversations.map((conv) => ({
    ...conv,
    unreadCount: conv.conversation_reads[0]?.unreadCount ?? 0,
  }))

  return Response.json({ conversations })
}
