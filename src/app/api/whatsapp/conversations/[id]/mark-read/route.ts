import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

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

    await prisma.waConversationRead.upsert({
      where: { userId_conversationId: { userId: user.id, conversationId } },
      update: { unreadCount: 0, lastReadAt: new Date() },
      create: { userId: user.id, conversationId, unreadCount: 0 },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
