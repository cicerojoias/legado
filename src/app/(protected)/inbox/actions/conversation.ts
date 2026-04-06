'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type ToggleResult =
  | { success: true; ia_ativa: boolean }
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
