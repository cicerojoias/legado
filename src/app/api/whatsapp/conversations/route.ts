import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/whatsapp/conversations — lista paginada de conversas
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status') ?? 'open'

  const conversations = await prisma.waConversation.findMany({
    where: status !== 'all' ? { status } : undefined,
    orderBy: { last_message_at: 'desc' },
    include: {
      contact: true,
      messages: {
        orderBy: { timestamp: 'desc' },
        take: 1,
      },
    },
    take: 50,
  })

  return Response.json({ conversations })
}
