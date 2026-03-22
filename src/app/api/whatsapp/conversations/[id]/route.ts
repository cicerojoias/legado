import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// GET /api/whatsapp/conversations/[id] — conversa + mensagens paginadas
export async function GET(_req: Request, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  const conversation = await prisma.waConversation.findUnique({
    where: { id },
    include: {
      contact: true,
      messages: {
        orderBy: { timestamp: 'asc' },
        take: 100,
      },
    },
  })

  if (!conversation) {
    return Response.json({ error: 'Não encontrada' }, { status: 404 })
  }

  return Response.json({ conversation })
}

// POST /api/whatsapp/conversations/[id]/resolve — marca como resolvida
export async function POST(_req: Request, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params

  const conversation = await prisma.waConversation.update({
    where: { id },
    data: { status: 'resolved' },
  })

  return Response.json({ conversation })
}

// DELETE /api/whatsapp/conversations/[id]?action=clear|delete
export async function DELETE(req: Request, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const action = searchParams.get('action')

  if (action === 'clear') {
    // Apaga apenas as mensagens
    await prisma.waMessage.deleteMany({ where: { conversation_id: id } })
    return Response.json({ success: true, action: 'clear' })
  }

  // action === 'delete' ou default
  // Como não há onDelete: Cascade no schema, deletamos as mensagens primeiro
  await prisma.waMessage.deleteMany({ where: { conversation_id: id } })
  await prisma.waConversation.delete({ where: { id } })

  return Response.json({ success: true, action: 'delete' })
}
