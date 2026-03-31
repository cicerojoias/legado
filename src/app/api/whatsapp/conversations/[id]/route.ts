import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

const PAGE_SIZE = 100

// GET /api/whatsapp/conversations/[id]?before=<ISO>
// Sem before: retorna as últimas PAGE_SIZE mensagens (mais recentes).
// Com before: retorna PAGE_SIZE mensagens anteriores ao cursor (cursor-based pagination).
// Resposta inclui hasMore para o cliente saber se deve exibir "carregar mais".
export async function GET(req: Request, { params }: RouteParams) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const beforeParam = searchParams.get('before')
  const before = beforeParam ? new Date(beforeParam) : null

  const conversation = await prisma.waConversation.findUnique({
    where: { id },
    include: { contact: true },
  })

  if (!conversation) {
    return Response.json({ error: 'Não encontrada' }, { status: 404 })
  }

  // Busca PAGE_SIZE + 1 para detectar se há mais páginas (sem COUNT extra)
  const rawMessages = await prisma.waMessage.findMany({
    where: {
      conversation_id: id,
      ...(before ? { timestamp: { lt: before } } : {}),
    },
    orderBy: { timestamp: 'desc' },
    take: PAGE_SIZE + 1,
  })

  const hasMore = rawMessages.length > PAGE_SIZE
  // Retorna no máximo PAGE_SIZE, ordenado ASC para renderização
  const messages = rawMessages.slice(0, PAGE_SIZE).reverse()

  return Response.json({ conversation: { ...conversation, messages }, hasMore })
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
