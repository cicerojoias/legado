import { createClient as createAdminClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'
import { uploadMediaToMeta, sendMediaByMediaId } from '@/lib/whatsapp/meta-client'
import { getWhatsAppMediaType } from '@/lib/whatsapp/mime-utils'
import { WhatsAppError } from '@/lib/whatsapp/errors'

// ── Constantes de segurança ────────────────────────────────────────────────────

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'video/mp4',
  'application/pdf',
])

// Limites oficiais da Meta Cloud API por tipo de mídia (bytes)
const META_SIZE_LIMITS: Record<string, number> = {
  image:    5  * 1024 * 1024,  //   5 MB
  audio:    16 * 1024 * 1024,  //  16 MB
  video:    16 * 1024 * 1024,  //  16 MB
  document: 100 * 1024 * 1024, // 100 MB
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // 1. Autenticação
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Rate limit: 30 envios / 15 min por usuário (igual às mutations financeiras)
  const rl = rateLimit(`send-media:${user.id}`, 30, 15)
  if (!rl.success) return Response.json({ error: rl.message }, { status: 429 })

  // 3. Parse do body
  let body: { conversationId?: string; mediaUrl?: string; mimeType?: string; caption?: string }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { conversationId, mediaUrl, mimeType, caption } = body

  if (!conversationId || !mediaUrl || !mimeType) {
    return Response.json({ error: 'conversationId, mediaUrl e mimeType são obrigatórios' }, { status: 400 })
  }

  // 4. Validar MIME type contra allowlist (previne Content-Type injection no multipart para Meta)
  if (!ALLOWED_MIME.has(mimeType)) {
    return Response.json({ error: 'Tipo de arquivo não suportado pelo WhatsApp.' }, { status: 400 })
  }

  // 5. SSRF Guard: garantir que mediaUrl pertence ao nosso Supabase Storage
  //    Nunca fazer fetch() com URL arbitrária do cliente — usa SDK com path validado
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    console.error('[send-media] NEXT_PUBLIC_SUPABASE_URL não configurada')
    return Response.json({ error: 'Configuração de servidor inválida' }, { status: 500 })
  }

  const expectedPrefix = `${supabaseUrl}/storage/v1/object/public/whatsapp-media/`
  if (!mediaUrl.startsWith(expectedPrefix)) {
    return Response.json({ error: 'URL de mídia inválida' }, { status: 400 })
  }

  // 6. Extrair e validar storagePath (deve ser outbound/ — nunca inbound/)
  const storagePath = mediaUrl.slice(expectedPrefix.length)
  if (!storagePath.startsWith('outbound/')) {
    return Response.json({ error: 'Path de mídia inválido' }, { status: 400 })
  }

  // 7. Buscar conversa + contato
  const conversation = await prisma.waConversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  })
  if (!conversation) {
    return Response.json({ error: 'Conversa não encontrada' }, { status: 404 })
  }

  // 8. Determinar waType para validação de tamanho
  const waType = getWhatsAppMediaType(mimeType)

  try {
    // 9. Download do buffer via Supabase SDK (service role — nunca fetch arbitrário)
    const adminSupabase = createAdminClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: blobData, error: downloadError } = await adminSupabase.storage
      .from('whatsapp-media')
      .download(storagePath)

    if (downloadError || !blobData) {
      console.error('[send-media] Falha ao baixar do Storage:', downloadError?.message)
      throw new WhatsAppError(
        'INTERNAL_ERROR',
        'Não foi possível recuperar o arquivo. Tente enviar novamente.'
      )
    }

    // 10. Validar tamanho do buffer contra limites da Meta (file-uploads skill: SET SIZE LIMITS)
    const buffer = Buffer.from(await blobData.arrayBuffer())
    const sizeLimit = META_SIZE_LIMITS[waType]
    if (buffer.length > sizeLimit) {
      const sizeText = waType === 'image' ? 'imagens' : waType === 'audio' ? 'áudios' : waType === 'video' ? 'vídeos' : 'documentos'
      throw new WhatsAppError(
        'SIZE_EXCEEDED',
        `Arquivo muito grande. O WhatsApp aceita no máximo ${sizeLimit / 1024 / 1024}MB para ${sizeText}.`
      )
    }

    // 11. Upload para Meta e envio atômico (media_id expira — usar imediatamente)
    const fileName = storagePath.split('/').pop() ?? 'media'
    const mediaId = await uploadMediaToMeta(buffer, mimeType, fileName)
    const waMessageId = await sendMediaByMediaId(
      conversation.contact.phone,
      mediaId,
      mimeType,
      caption
    )

    // 12. Persistir mensagem no banco (mediaUrl do Supabase para exibir na inbox)
    const displayContent =
      waType === 'image' ? '[Imagem]' :
      waType === 'audio' ? '[Áudio]'  :
      waType === 'video' ? '[Vídeo]'  : '[Arquivo]'

    const message = await prisma.waMessage.create({
      data: {
        conversation_id: conversationId,
        wa_message_id: waMessageId || undefined,
        direction: 'outbound',
        type: waType,
        content: caption ?? displayContent,
        mediaUrl,
        mimeType,
        status: 'sent',
        sent_by: user.id,
        timestamp: new Date(),
      },
    })

    await prisma.waConversation.update({
      where: { id: conversationId },
      data: { last_message_at: new Date() },
    })

    // Log reduzido: sem expor mediaUrl ou paths internos
    console.log('[send-media] ok', { to: conversation.contact.phone, mimeType, waMessageId })

    return Response.json({ message })
  } catch (error: unknown) {
    if (error instanceof WhatsAppError) {
      return Response.json(error.toJSON(), { status: error.statusCode })
    }

    const msg = error instanceof Error ? error.message : String(error)
    console.error('[send-media] Erro desconhecido:', msg)

    // Erros da Meta API têm "Meta Media" na mensagem
    if (msg.includes('Meta Media')) {
      const waError = new WhatsAppError(
        'UPLOAD_FAILED',
        'O WhatsApp recusou o envio. Verifique o arquivo e tente novamente.'
      )
      return Response.json(waError.toJSON(), { status: waError.statusCode })
    }

    // Generic error para o cliente
    return Response.json(
      { error: 'Erro interno ao enviar. Tente novamente em instantes.' },
      { status: 500 }
    )
  }
}
