'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { WaSettings } from '@prisma/client'

const SINGLETON_ID = 'singleton'

type SettingsResult =
  | { success: true }
  | { success: false; code: 'NAO_AUTORIZADO' | 'CAMPOS_INVALIDOS' | 'ERRO_INTERNO'; message?: string }

async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
  if (!dbUser || !dbUser.ativo || dbUser.role === 'OPERADOR') return null
  return dbUser
}

export async function getSettings(): Promise<WaSettings> {
  return prisma.waSettings.upsert({
    where:  { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  })
}

const WelcomeSchema = z.object({
  enabled: z.boolean(),
  message: z.string().max(1000).transform(v => v.trim()),
})

export async function saveWelcomeSettings(enabled: boolean, message: string): Promise<SettingsResult> {
  const admin = await getAdminUser()
  if (!admin) return { success: false, code: 'NAO_AUTORIZADO' }

  const parsed = WelcomeSchema.safeParse({ enabled, message })
  if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' }

  // Toggle só pode ser ligado se houver mensagem preenchida
  if (parsed.data.enabled && !parsed.data.message) {
    return { success: false, code: 'CAMPOS_INVALIDOS', message: 'Preencha a mensagem antes de ativar.' }
  }

  try {
    await prisma.waSettings.upsert({
      where:  { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, welcome_enabled: parsed.data.enabled, welcome_message: parsed.data.message || null },
      update: { welcome_enabled: parsed.data.enabled, welcome_message: parsed.data.message || null },
    })
    revalidatePath('/inbox', 'layout')
    return { success: true }
  } catch {
    return { success: false, code: 'ERRO_INTERNO' }
  }
}
