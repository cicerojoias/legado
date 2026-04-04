'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WaTag } from '@prisma/client'

export const TAG_COLORS = [
  'amber', 'rose', 'sky', 'violet', 'orange',
  'teal', 'pink', 'indigo', 'lime', 'cyan',
] as const

export type TagColor = typeof TAG_COLORS[number]

export type TagActionResult =
  | { success: true; tag?: WaTag }
  | { success: false; code: 'NAO_AUTORIZADO' | 'CAMPOS_INVALIDOS' | 'NOME_DUPLICADO' | 'TAG_EM_USO' | 'ERRO_INTERNO'; message?: string }

const CreateTagSchema = z.object({
  name:  z.string().min(1).max(30).transform(v => v.trim().toLowerCase()),
  color: z.enum(TAG_COLORS),
})

const UpdateTagSchema = CreateTagSchema.extend({
  id: z.string().uuid(),
})

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !dbUser.ativo || dbUser.role === 'OPERADOR') return null

  return { authId: user.id, dbUser }
}

export async function createTag(formData: FormData): Promise<TagActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, code: 'NAO_AUTORIZADO' }

  const parsed = CreateTagSchema.safeParse({
    name:  formData.get('name'),
    color: formData.get('color'),
  })
  if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' }

  try {
    const tag = await prisma.waTag.create({ data: parsed.data })
    revalidatePath('/inbox', 'layout')
    return { success: true, tag }
  } catch (e: unknown) {
    if (isPrismaError(e, 'P2002')) {
      return { success: false, code: 'NOME_DUPLICADO', message: 'Já existe uma tag com esse nome.' }
    }
    return { success: false, code: 'ERRO_INTERNO' }
  }
}

export async function updateTag(formData: FormData): Promise<TagActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, code: 'NAO_AUTORIZADO' }

  const parsed = UpdateTagSchema.safeParse({
    id:    formData.get('id'),
    name:  formData.get('name'),
    color: formData.get('color'),
  })
  if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' }

  const { id, ...data } = parsed.data

  try {
    const tag = await prisma.waTag.update({ where: { id }, data })
    revalidatePath('/inbox', 'layout')
    return { success: true, tag }
  } catch (e: unknown) {
    if (isPrismaError(e, 'P2002')) {
      return { success: false, code: 'NOME_DUPLICADO', message: 'Já existe uma tag com esse nome.' }
    }
    return { success: false, code: 'ERRO_INTERNO' }
  }
}

export async function deleteTag(id: string): Promise<TagActionResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, code: 'NAO_AUTORIZADO' }

  if (!z.string().uuid().safeParse(id).success) {
    return { success: false, code: 'CAMPOS_INVALIDOS' }
  }

  try {
    await prisma.waTag.delete({ where: { id } })
    revalidatePath('/inbox', 'layout')
    return { success: true }
  } catch (e: unknown) {
    if (isPrismaError(e, 'P2003') || isPrismaError(e, 'P2014')) {
      return {
        success: false,
        code: 'TAG_EM_USO',
        message: 'Esta tag está em uso em conversas. Remova-a das conversas antes de excluir.',
      }
    }
    return { success: false, code: 'ERRO_INTERNO' }
  }
}

export async function listTags(): Promise<WaTag[]> {
  return prisma.waTag.findMany({ orderBy: { name: 'asc' } })
}

function isPrismaError(e: unknown, code: string): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code: string }).code === code
  )
}
