import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ total: 0 })

    const reads = await prisma.waConversationRead.findMany({
      where: { userId: user.id },
      select: { unreadCount: true },
    })

    const total = reads.reduce((sum, r) => sum + r.unreadCount, 0)
    const totalConversations = reads.filter((r) => r.unreadCount > 0).length
    return NextResponse.json({ total, totalConversations })
  } catch {
    return NextResponse.json({ total: 0, totalConversations: 0 })
  }
}
