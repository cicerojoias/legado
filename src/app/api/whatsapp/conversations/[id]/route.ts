import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { createServerTiming } from '@/lib/server-timing'

interface RouteParams {
  params: Promise<{ id: string }>
}

const DEFAULT_PAGE_SIZE = 100
const MAX_PAGE_SIZE = 100

// GET /api/whatsapp/conversations/[id]?before=<ISO>&limit=<n>
// Sem before: retorna as últimas `limit` mensagens (mais recentes).
// Com before: retorna `limit` mensagens anteriores ao cursor (cursor-based pagination).
// Resposta inclui hasMore para o cliente saber se deve exibir "carregar mais".
export async function GET(req: Request, { params }: RouteParams) {
  const timing = createServerTiming('api/whatsapp/conversation-messages')
  const supabase = await createClient()
  const { data: { user } } = await timing.measure('auth', supabase.auth.getUser())
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id } = await params
  const { searchParams } = new URL(req.url)
  const beforeParam = searchParams.get('before')
  const before = beforeParam ? new Date(beforeParam) : null
  const limitParam = Number.parseInt(searchParams.get('limit') ?? '', 10)
  const pageSize = Number.isFinite(limitParam)
    ? Math.min(Math.max(limitParam, 1), MAX_PAGE_SIZE)
    : DEFAULT_PAGE_SIZE

  // Conversa e mensagens em paralelo; busca pageSize + 1 para detectar se há mais páginas (sem COUNT extra)
  const [conversation, rawMessages] = await timing.measure('db', Promise.all([
    prisma.waConversation.findUnique({
      where: { id },
      include: { contact: true },
    }),
    prisma.waMessage.findMany({
      where: {
        conversation_id: id,
        ...(before ? { timestamp: { lt: before } } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: pageSize + 1,
    }),
  ]))

  if (!conversation) {
    return Response.json({ error: 'Não encontrada' }, { status: 404 })
  }

  const hasMore = rawMessages.length > pageSize
  // Retorna no máximo pageSize, ordenado ASC para renderização
  const messages = rawMessages.slice(0, pageSize).reverse()

  return Response.json(
    { conversation: { ...conversation, messages }, hasMore },
    { headers: { 'Server-Timing': timing.header() } }
  )
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
