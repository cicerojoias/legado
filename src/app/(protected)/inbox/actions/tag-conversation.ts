'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { TagActionResult } from './tag-catalog'

const TagAssignSchema = z.object({
  conversationId: z.string().uuid(),
  tagId:          z.string().uuid(),
})

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !dbUser.ativo || dbUser.role === 'OPERADOR') return null

  return { authId: user.id, dbUser }
}

export async function assignTag(conversationId: string, tagId: string): Promise<TagActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, code: 'NAO_AUTORIZADO' }

  const parsed = TagAssignSchema.safeParse({ conversationId, tagId })
  if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' }

  try {
    await prisma.conversationTag.create({
      data: {
        conversationId,
        tagId,
        assignedBy: admin.authId,
      },
    })
  } catch (e: unknown) {
    // P2002 = unique constraint — tag já aplicada, tratar como sucesso (idempotente)
    if (!isPrismaError(e, 'P2002')) {
      return { success: false, code: 'ERRO_INTERNO' }
    }
  }

  revalidatePath('/inbox', 'layout')
  return { success: true }
}

export async function removeTag(conversationId: string, tagId: string): Promise<TagActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, code: 'NAO_AUTORIZADO' }

  const parsed = TagAssignSchema.safeParse({ conversationId, tagId })
  if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' }

  await prisma.conversationTag.deleteMany({ where: { conversationId, tagId } })
  revalidatePath('/inbox', 'layout')
  return { success: true }
}

function isPrismaError(e: unknown, code: string): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: string }).code === code
  )
}
