import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { WhatsAppError } from '@/lib/whatsapp/errors'
import { persistMediaToR2 } from '@/lib/whatsapp/media-uploader'

/**
 * POST /api/whatsapp/migrate-media
 *
 * Migra mensagens inbound com mediaId da Meta para o Cloudflare R2 permanentemente.
 * Aceita query params `limit` (default 20) e `conversationId`.
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
    const limit = parseInt(searchParams.get('limit') ?? '20', 10)
    const conversationId = searchParams.get('conversationId')

    const where: any = {
      direction: 'inbound',
      mediaId: { not: null },
    }

    if (conversationId) {
      where.conversation_id = conversationId
    }

    // Busca mensagens que possuem mediaId
    const pending = await prisma.waMessage.findMany({
      where,
      select: { id: true, mediaId: true, mimeType: true },
      orderBy: { timestamp: 'desc' },
      take: limit,
    })

    if (pending.length === 0) {
      return NextResponse.json({ migrated: 0, message: 'Nenhuma mídia encontrada para migração' })
    }

    let successCount = 0
    let failureCount = 0
    const results: Array<{ id: string; mediaId: string; success: boolean }> = []

    for (const msg of pending) {
      if (!msg.mediaId) continue
      const mimeType = msg.mimeType || 'image/jpeg'
      
      const success = await persistMediaToR2(msg.mediaId, mimeType)
      if (success) {
        successCount++
      } else {
        failureCount++
      }
      results.push({ id: msg.id, mediaId: msg.mediaId, success })
    }

    return NextResponse.json({
      total: pending.length,
      migrated: successCount,
      failed: failureCount,
      results,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[migrate-media] Erro durante a migração:', msg)
    return NextResponse.json({ error: 'Erro ao migrar mídias', details: msg }, { status: 500 })
  }
}
