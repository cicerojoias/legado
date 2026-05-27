import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/whatsapp/conversations/[conversationId]/search-messages?q=...
export async function GET(
  req: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { conversationId } = await params
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('q')

  if (!conversationId) {
    return Response.json({ error: 'conversationId é obrigatório' }, { status: 400 })
  }

  if (!query || !query.trim()) {
    return Response.json({ messages: [] })
  }

  try {
    const rawMessages = await prisma.waMessage.findMany({
      where: {
        conversation_id: conversationId,
        content: {
          contains: query.trim(),
          mode: 'insensitive',
        },
        // Apenas mensagens que não foram apagadas e contêm texto
        type: { not: 'deleted' },
      },
      orderBy: { timestamp: 'desc' },
      take: 100, // limita a 100 resultados por busca por segurança/performance
    })

    return Response.json({ messages: rawMessages })
  } catch (error) {
    console.error('[search-messages] Erro ao buscar mensagens:', error)
    return Response.json(
      { error: 'Erro interno ao realizar busca' },
      { status: 500 }
    )
  }
}
