'use server'

import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

type NoteResult =
  | { success: true }
  | { success: false; code: 'NAO_AUTORIZADO' | 'NAO_ENCONTRADO' | 'CAMPOS_INVALIDOS' | 'ERRO_INTERNO'; message?: string }

async function getWabUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, ativo: true },
  })

  if (!dbUser?.ativo) return null
  return dbUser
}

const NoteContentSchema = z.string().trim().min(1, 'A nota não pode ficar vazia.').max(2000, 'A nota é muito longa.')

const CreateNoteSchema = z.object({
  conversationId: z.string().min(1),
  content: NoteContentSchema,
})

const UpdateNoteSchema = z.object({
  conversationId: z.string().min(1),
  noteId: z.string().min(1),
  content: NoteContentSchema,
})

const DeleteNoteSchema = z.object({
  conversationId: z.string().min(1),
  noteId: z.string().min(1),
})

export async function createConversationNote(conversationId: string, content: string): Promise<NoteResult> {
  const user = await getWabUser()
  if (!user) return { success: false, code: 'NAO_AUTORIZADO' }

  const parsed = CreateNoteSchema.safeParse({ conversationId, content })
  if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' }

  try {
    const conversation = await prisma.waConversation.findUnique({
      where: { id: parsed.data.conversationId },
      select: { id: true },
    })

    if (!conversation) return { success: false, code: 'NAO_ENCONTRADO' }

    await prisma.waConversationNote.create({
      data: {
        conversation_id: conversation.id,
        author_id: user.id,
        content: parsed.data.content,
      },
    })

    revalidatePath(`/inbox/${conversation.id}`)
    return { success: true }
  } catch {
    return { success: false, code: 'ERRO_INTERNO' }
  }
}

export async function updateConversationNote(conversationId: string, noteId: string, content: string): Promise<NoteResult> {
  const user = await getWabUser()
  if (!user) return { success: false, code: 'NAO_AUTORIZADO' }

  const parsed = UpdateNoteSchema.safeParse({ conversationId, noteId, content })
  if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' }

  try {
    const updated = await prisma.waConversationNote.updateMany({
      where: {
        id: parsed.data.noteId,
        conversation_id: parsed.data.conversationId,
        deleted_at: null,
      },
      data: {
        content: parsed.data.content,
      },
    })

    if (updated.count === 0) return { success: false, code: 'NAO_ENCONTRADO' }

    revalidatePath(`/inbox/${parsed.data.conversationId}`)
    return { success: true }
  } catch {
    return { success: false, code: 'ERRO_INTERNO' }
  }
}

export async function deleteConversationNote(conversationId: string, noteId: string): Promise<NoteResult> {
  const user = await getWabUser()
  if (!user) return { success: false, code: 'NAO_AUTORIZADO' }

  const parsed = DeleteNoteSchema.safeParse({ conversationId, noteId })
  if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' }

  try {
    const deleted = await prisma.waConversationNote.updateMany({
      where: {
        id: parsed.data.noteId,
        conversation_id: parsed.data.conversationId,
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
      },
    })

    if (deleted.count === 0) return { success: false, code: 'NAO_ENCONTRADO' }

    revalidatePath(`/inbox/${parsed.data.conversationId}`)
    return { success: true }
  } catch {
    return { success: false, code: 'ERRO_INTERNO' }
  }
}
