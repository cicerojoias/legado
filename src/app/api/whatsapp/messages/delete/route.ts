import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteMessage } from '@/lib/whatsapp/meta-client'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

const SIXTY_HOURS_MS = 60 * 60 * 60 * 1000

export async function DELETE(req: NextRequest) {
  // ── Autenticação ───────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limiting: 10 deletes / 15 min por usuário ─────────────────────────
  const rl = await rateLimit(`wa-delete:${user.id}`, 10, 15)
  if (!rl.success) {
    return NextResponse.json({ error: rl.message }, { status: 429 })
  }

  // ── Parse e validação do body ──────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { messageIds, conversationId } = body as { messageIds?: unknown; conversationId?: unknown }

  if (
    !Array.isArray(messageIds) ||
    messageIds.length === 0 ||
    messageIds.length > 30 ||
    messageIds.some((id) => typeof id !== 'string') ||
    typeof conversationId !== 'string' ||
    !conversationId
  ) {
    return NextResponse.json(
      { error: 'messageIds (array de até 30 strings) e conversationId são obrigatórios' },
      { status: 400 }
    )
  }

  // ── Busca com ownership check (IDOR prevention) ────────────────────────────
  // A query filtra explicitamente conversation_id + direction = 'outbound'
  // garantindo que apenas mensagens enviadas por nós, nessa conversa, sejam acessíveis.
  const now = Date.now()
  const messages = await prisma.waMessage.findMany({
    where: {
      id: { in: messageIds as string[] },
      conversation_id: conversationId,
      direction: 'outbound',
    },
    select: { id: true, wa_message_id: true, timestamp: true },
  })

  if (messages.length === 0) {
    return NextResponse.json({ error: 'Nenhuma mensagem elegível encontrada' }, { status: 404 })
  }

  // ── Processamento por mensagem ─────────────────────────────────────────────
  let deleted = 0
  let skipped = 0
  const errors: string[] = []

  for (const msg of messages) {
    // Revalidação server-side da janela de 60h
    const age = now - new Date(msg.timestamp).getTime()
    if (age > SIXTY_HOURS_MS) {
      skipped++
      continue
    }

    if (!msg.wa_message_id) {
      skipped++
      continue
    }

    try {
      // Chama a Meta API para deletar para todos
      await deleteMessage(msg.wa_message_id)

      // Persiste a deleção no banco — limpa conteúdo e marca o tipo
      await prisma.waMessage.update({
        where: { id: msg.id },
        data: {
          content: null,
          type: 'deleted',
          mediaUrl: null,
        },
      })

      deleted++
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      errors.push(`${msg.id}: ${reason}`)
      console.error('[wa-delete] falha ao deletar mensagem', msg.id, reason)
    }
  }

  // ── Audit log ─────────────────────────────────────────────────────────────
  if (deleted > 0) {
    await prisma.log.create({
      data: {
        acao: 'WA_MESSAGE_DELETED',
        detalhe: `${deleted} mensagem(ns) deletada(s) na conversa ${conversationId}`,
        usuario_id: user.id,
      },
    }).catch(() => {}) // silencia falha de log — não bloqueia a resposta
  }

  return NextResponse.json({ deleted, skipped, errors: errors.length > 0 ? errors : undefined })
}
