import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { markAsRead } from '@/lib/whatsapp/meta-client'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // 1. Buscar todas as mensagens inbound NÃO lidas desta conversa
    const unreadMessages = await prisma.waMessage.findMany({
      where: {
        conversation_id: conversationId,
        direction: 'inbound',
        status: { not: 'read' },
      },
      select: {
        id: true,
        wa_message_id: true,
        status: true,
      },
    })

    // 2. Marcar cada mensagem como "read" na API da Meta (double check dourado)
    const markPromises = unreadMessages
      .filter((msg) => msg.wa_message_id) // Só marca se tiver wa_message_id
      .map(async (msg) => {
        try {
          await markAsRead(msg.wa_message_id!)
          // Atualiza status no banco local
          await prisma.waMessage.update({
            where: { id: msg.id },
            data: { status: 'read' },
          })
        } catch (err) {
          console.error(`[mark-read] Falha ao marcar mensagem ${msg.wa_message_id}:`, err)
        }
      })

    // Executa em paralelo para performance
    await Promise.all(markPromises)

    // 3. Atualizar registro de leitura do usuário
    await prisma.waConversationRead.upsert({
      where: { userId_conversationId: { userId: user.id, conversationId } },
      update: { unreadCount: 0, lastReadAt: new Date() },
      create: { userId: user.id, conversationId, unreadCount: 0 },
    })

    console.log(`[mark-read] ${markPromises.length} mensagens marcadas como lidas na conversa ${conversationId}`)

    return NextResponse.json({ ok: true, marked: markPromises.length })
  } catch (err) {
    console.error('[mark-read] Erro interno:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
