import { createClient as createAdminClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  sendTextMessage,
  sendMediaByMediaId,
  downloadMediaBuffer,
  uploadMediaToMeta,
} from '@/lib/whatsapp/meta-client'

const MAX_MESSAGES = 10
const MAX_CONVERSATIONS = 10

export async function POST(req: Request) {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // ── Rate limit ────────────────────────────────────────────────────────────
  const rl = rateLimit(`forward:${user.id}`, 20, 15)
  if (!rl.success) return Response.json({ error: rl.message }, { status: 429 })

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { messageIds?: string[]; conversationIds?: string[] }
  try { body = await req.json() }
  catch { return Response.json({ error: 'Body inválido' }, { status: 400 }) }

  const { messageIds, conversationIds } = body
  if (!messageIds?.length || !conversationIds?.length) {
    return Response.json({ error: 'messageIds e conversationIds são obrigatórios' }, { status: 400 })
  }
  if (messageIds.length > MAX_MESSAGES) {
    return Response.json({ error: `Máximo de ${MAX_MESSAGES} mensagens por encaminhamento` }, { status: 400 })
  }
  if (conversationIds.length > MAX_CONVERSATIONS) {
    return Response.json({ error: `Máximo de ${MAX_CONVERSATIONS} conversas` }, { status: 400 })
  }

  // ── Carregar mensagens e conversas ────────────────────────────────────────
  const [messages, conversations] = await Promise.all([
    prisma.waMessage.findMany({
      where: { id: { in: messageIds } },
      orderBy: { timestamp: 'asc' },
    }),
    prisma.waConversation.findMany({
      where: { id: { in: conversationIds } },
      include: { contact: true },
    }),
  ])

  if (conversations.length === 0) {
    return Response.json({ error: 'Nenhuma conversa encontrada' }, { status: 404 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const storagePrefix = `${supabaseUrl}/storage/v1/object/public/whatsapp-media/`

  let forwarded = 0
  const errors: Array<{ conversationId: string; error: string }> = []

  for (const conversation of conversations) {
    const phone = conversation.contact.phone

    for (const msg of messages) {
      if (msg.type === 'deleted') continue

      try {
        let waMessageId = ''

        // ── Texto ──────────────────────────────────────────────────────────
        if (msg.type === 'text') {
          waMessageId = await sendTextMessage(phone, msg.content ?? '')

        // ── Mídia inbound (tem mediaId da Meta) ────────────────────────────
        } else if (msg.mediaId) {
          const caption = msg.content && !['[Imagem]', '[Vídeo]', '[Documento]', '[Áudio]'].includes(msg.content)
            ? msg.content
            : undefined

          try {
            waMessageId = await sendMediaByMediaId(phone, msg.mediaId, msg.mimeType ?? 'application/octet-stream', caption)
          } catch {
            // Fallback: mediaId pode ter expirado (~30d) → baixar e re-fazer upload
            const buffer = await downloadMediaBuffer(msg.mediaId)
            const ext = msg.mimeType?.split('/')[1] ?? 'bin'
            const newId = await uploadMediaToMeta(buffer, msg.mimeType ?? 'application/octet-stream', `media.${ext}`)
            waMessageId = await sendMediaByMediaId(phone, newId, msg.mimeType ?? 'application/octet-stream', caption)
          }

        // ── Mídia outbound (URL no Supabase Storage) ───────────────────────
        } else if (msg.mediaUrl?.startsWith(storagePrefix)) {
          const storagePath = msg.mediaUrl.slice(storagePrefix.length)
          if (!storagePath.startsWith('outbound/')) continue // segurança: nunca servir inbound por aqui

          const adminSupabase = createAdminClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!)
          const { data: blobData, error: dlErr } = await adminSupabase.storage
            .from('whatsapp-media')
            .download(storagePath)

          if (dlErr || !blobData) throw new Error(`Falha ao baixar mídia: ${dlErr?.message}`)

          const buffer = Buffer.from(await blobData.arrayBuffer())
          const fileName = storagePath.split('/').pop() ?? 'media'
          const metaMediaId = await uploadMediaToMeta(buffer, msg.mimeType!, fileName)

          const caption = msg.content && !['[Imagem]', '[Vídeo]', '[Documento]', '[Áudio]'].includes(msg.content)
            ? msg.content
            : undefined

          waMessageId = await sendMediaByMediaId(phone, metaMediaId, msg.mimeType!, caption)
        } else {
          continue // sem mídia acessível — pular
        }

        // ── Persistir no banco ─────────────────────────────────────────────
        await prisma.waMessage.create({
          data: {
            conversation_id: conversation.id,
            wa_message_id: waMessageId || undefined,
            direction: 'outbound',
            type: msg.type,
            content: msg.content,
            mimeType: msg.mimeType,
            status: 'sent',
            sent_by: user.id,
            timestamp: new Date(),
            forwarded: true,
          },
        })

        await prisma.waConversation.update({
          where: { id: conversation.id },
          data: { last_message_at: new Date() },
        })

        forwarded++
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error('[forward] erro:', { conversationId: conversation.id, msgId: msg.id, err: errMsg })
        errors.push({ conversationId: conversation.id, error: errMsg })
      }
    }
  }

  return Response.json({ forwarded, errors })
}
