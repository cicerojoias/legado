import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { WhatsAppError } from '@/lib/whatsapp/errors'

/**
 * POST /api/whatsapp/reprocess-media?conversationId=<id>
 *
 * Corrige mensagens inbound que têm mediaId mas mediaUrl null ou apontando para
 * o Supabase Storage (fluxo antigo). Atualiza para o proxy /api/whatsapp/media/[mediaId].
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const error = new WhatsAppError('UNAUTHORIZED', 'Não autorizado')
    return NextResponse.json(error.toJSON(), { status: 401 })
  }

  try {
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
    const pending = await prisma.waMessage.findMany({
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

    // Filtrar apenas mensagens com mediaId não-nulo e atualizar
    const messagesToUpdate = pending.filter((msg) => msg.mediaId !== null)

    if (messagesToUpdate.length === 0) {
      return NextResponse.json({ reprocessed: 0, message: 'Nenhuma mídia com mediaId para reprocessar' })
    }

    // Atualiza para o proxy local (imediato, sem download)
    await Promise.all(
      messagesToUpdate.map((msg) =>
        prisma.waMessage.update({
          where: { id: msg.id },
          data: { mediaUrl: `/api/whatsapp/media/${msg.mediaId!}` },
        })
      )
    )

    console.log(`[reprocess-media] Atualizadas ${messagesToUpdate.length} mensagens para proxy local`)
    return NextResponse.json({ reprocessed: messagesToUpdate.length })
  } catch (error) {
    if (error instanceof WhatsAppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode })
    }

    const msg = error instanceof Error ? error.message : String(error)
    console.error('[reprocess-media] Erro:', msg)
    const genericError = new WhatsAppError('INTERNAL_ERROR', 'Erro ao reprocessar mídias')
    return NextResponse.json(genericError.toJSON(), { status: 500 })
  }
}
