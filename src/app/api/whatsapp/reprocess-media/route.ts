import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

/**
 * POST /api/whatsapp/reprocess-media?conversationId=<id>
 *
 * Corrige mensagens inbound que têm mediaId mas mediaUrl null ou apontando para
 * o Supabase Storage (fluxo antigo). Atualiza para o proxy /api/whatsapp/media/[mediaId].
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { searchParams } = new URL(req.url)
  const conversationId = searchParams.get('conversationId')

  const where: Record<string, unknown> = {
    direction: 'inbound',
    mediaId: { not: null },
  }

  if (conversationId) {
    where.conversation_id = conversationId
  }

  // Busca mensagens com mediaId mas sem mediaUrl (ou com URL de Storage antiga)
  const pending = await (prisma as any).waMessage.findMany({
    where: {
      ...where,
      OR: [
        { mediaUrl: null },
        { mediaUrl: { contains: 'supabase' } }, // migra URLs antigas do Storage
      ],
    },
    select: { id: true, mediaId: true },
    take: 50,
  })

  if (pending.length === 0) {
    return NextResponse.json({ reprocessed: 0, message: 'Nenhuma mídia pendente' })
  }

  // Atualiza para o proxy local (imediato, sem download)
  await Promise.all(
    pending.map((msg: { id: string; mediaId: string }) =>
      (prisma as any).waMessage.update({
        where: { id: msg.id },
        data: { mediaUrl: `/api/whatsapp/media/${msg.mediaId}` },
      })
    )
  )

  console.log(`[reprocess-media] Atualizadas ${pending.length} mensagens para proxy local`)
  return NextResponse.json({ reprocessed: pending.length })
}
