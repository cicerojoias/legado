'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { activateAiWithCatchUp, getAiCatchUpPreview } from '@/lib/whatsapp/ai-responder'

type ToggleResult =
  | { success: true; ia_ativa: boolean }
  | { success: false; code: 'NAO_AUTORIZADO' | 'NAO_ENCONTRADO' | 'ERRO_INTERNO' }

type CatchUpPreviewResult =
  | {
      success: true
      pendingCount: number
      windowStart: string
      lastOutboundAt: string | null
      snippets: Array<{ id: string; content: string | null; timestamp: string }>
    }
  | { success: false; code: 'NAO_AUTORIZADO' | 'NAO_ENCONTRADO' | 'ERRO_INTERNO' }

type CatchUpActivationResult =
  | { success: true; ia_ativa: boolean; pendingCount: number; sentCount: number }
  | { success: false; code: 'NAO_AUTORIZADO' | 'NAO_ENCONTRADO' | 'ERRO_INTERNO' }

export async function toggleIaAtiva(conversationId: string): Promise<ToggleResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, code: 'NAO_AUTORIZADO' }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { ativo: true },
  })
  if (!dbUser?.ativo) return { success: false, code: 'NAO_AUTORIZADO' }

  try {
    const current = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      select: { ia_ativa: true },
    })
    if (!current) return { success: false, code: 'NAO_ENCONTRADO' }

    const updated = await prisma.waConversation.update({
      where: { id: conversationId },
      data: { ia_ativa: !current.ia_ativa },
      select: { ia_ativa: true },
    })

    revalidatePath(`/inbox/${conversationId}`)
    return { success: true, ia_ativa: updated.ia_ativa }
  } catch {
    return { success: false, code: 'ERRO_INTERNO' }
  }
}

export async function getIaActivationPreview(conversationId: string): Promise<CatchUpPreviewResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, code: 'NAO_AUTORIZADO' }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { ativo: true },
  })
  if (!dbUser?.ativo) return { success: false, code: 'NAO_AUTORIZADO' }

  try {
    const conversation = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      select: { id: true },
    })
    if (!conversation) return { success: false, code: 'NAO_ENCONTRADO' }

    const preview = await getAiCatchUpPreview(conversationId)

    return {
      success: true,
      pendingCount: preview.pendingCount,
      windowStart: preview.windowStart.toISOString(),
      lastOutboundAt: preview.lastOutboundAt?.toISOString() ?? null,
      snippets: preview.snippets.map((snippet) => ({
        id: snippet.id,
        content: snippet.content,
        timestamp: snippet.timestamp.toISOString(),
      })),
    }
  } catch {
    return { success: false, code: 'ERRO_INTERNO' }
  }
}

export async function activateIaWithCatchUpAction(conversationId: string): Promise<CatchUpActivationResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, code: 'NAO_AUTORIZADO' }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { ativo: true },
  })
  if (!dbUser?.ativo) return { success: false, code: 'NAO_AUTORIZADO' }

  try {
    const conversation = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        ia_ativa: true,
        contact: {
          select: {
            wa_id: true,
          },
        },
      },
    })
    if (!conversation) return { success: false, code: 'NAO_ENCONTRADO' }

    if (conversation.ia_ativa) {
      return { success: true, ia_ativa: true, pendingCount: 0, sentCount: 0 }
    }

    const result = await activateAiWithCatchUp(conversationId, conversation.contact.wa_id)
    revalidatePath(`/inbox/${conversationId}`)

    return {
      success: true,
      ia_ativa: result.ia_ativa,
      pendingCount: result.pendingCount,
      sentCount: result.sentCount,
    }
  } catch {
    return { success: false, code: 'ERRO_INTERNO' }
  }
}
