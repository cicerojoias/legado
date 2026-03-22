import { createClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/prisma'
import { downloadMediaBuffer } from './meta-client'

// Tipos MIME permitidos -> extensão de arquivo para nomear no Storage
const ALLOWED_MIME_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'application/pdf': 'pdf',
}

// Magic Bytes: assinaturas binárias dos tipos permitidos
// Impede file-smuggling (ex: um .exe renomeado como .jpg)
// Use null para "qualquer byte" (wildcard)
const MAGIC_BYTES: Array<{ mime: string; bytes: (number | null)[] }> = [
  { mime: 'image/jpeg',    bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png',     bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/webp',    bytes: [0x52, 0x49, 0x46, 0x46] }, // "RIFF"
  { mime: 'audio/ogg',     bytes: [0x4f, 0x67, 0x67, 0x53] }, // "OggS"
  { mime: 'audio/mpeg',    bytes: [0xff, 0xfb] },
  { mime: 'audio/mpeg',    bytes: [0xff, 0xf3] },
  { mime: 'audio/mpeg',    bytes: [0xff, 0xf2] },
  { mime: 'audio/mpeg',    bytes: [0x49, 0x44, 0x33] },        // ID3
  // MP4: bytes 0-2 = 0x00 (high bytes do box size), byte 3 = tamanho variável (wildcard),
  // bytes 4-7 = 'ftyp'. Cobre boxes de 0x18, 0x1C, 0x20, 0x24... (24 a 36 bytes)
  { mime: 'video/mp4',     bytes: [0x00, 0x00, 0x00, null, 0x66, 0x74, 0x79, 0x70] },
  { mime: 'audio/webm',    bytes: [0x1A, 0x45, 0xDF, 0xA3] },   // EBML (WebM/Matroska)
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // "%PDF"
]

function matchesMagicBytes(buffer: Buffer): string | null {
  for (const entry of MAGIC_BYTES) {
    const matches = entry.bytes.every((b, i) => b === null || buffer[i] === b)
    if (matches) return entry.mime
  }
  return null
}

/**
 * Processa o download e armazenamento de uma mídia inbound do WhatsApp.
 * Deve ser chamado de forma assíncrona (após o HTTP 200 já ter sido retornado).
 *
 * @param waMessageDbId - ID do registro WaMessage no nosso banco (UUID)
 * @param mediaId       - ID da mídia na Meta para download
 * @param declaredMime  - MIME declarado pela Meta (validamos via magic bytes)
 */
export async function processInboundMedia(
  waMessageDbId: string,
  mediaId: string,
  declaredMime: string
): Promise<void> {
  // Normalizar antes de qualquer validação — a Meta envia "audio/ogg; codecs=opus"
  const normalizedDeclared = declaredMime.split(';')[0].trim()

  // 1. Validar se o tipo MIME declarado é permitido
  if (!ALLOWED_MIME_MAP[normalizedDeclared]) {
    console.warn(`[media-handler] MIME não permitido: ${normalizedDeclared} — abortando`)
    return
  }

  let buffer: Buffer
  try {
    // 2. Baixar o buffer binário da Meta (dois estágios internamente)
    buffer = await downloadMediaBuffer(mediaId)
  } catch (err) {
    console.error(`[media-handler] Falha ao baixar mídia ${mediaId}:`, err)
    return
  }

  // 3. Verificar Magic Bytes (anti-smuggling)
  const detectedMime = matchesMagicBytes(buffer)

  if (!detectedMime || (detectedMime !== normalizedDeclared && !isCompatibleMime(detectedMime, normalizedDeclared))) {
    console.warn(`[media-handler] Magic bytes não correspondem ao MIME declarado. Detectado: ${detectedMime}, Declarado: ${normalizedDeclared}`)
    return
  }

  // 4. Gerar path único no Supabase Storage: whatsapp-media/<mediaId>.<ext>
  const ext = ALLOWED_MIME_MAP[normalizedDeclared] ?? 'bin'
  const storagePath = `inbound/${mediaId}.${ext}`

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[media-handler] NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados — upload abortado')
    return
  }

  const adminSupabase = createClient(supabaseUrl, serviceRoleKey)

  // 5. Upload para Supabase Storage (service role ignora RLS — só no backend)
  const { error: uploadError } = await adminSupabase.storage
    .from('whatsapp-media')
    .upload(storagePath, buffer, {
      contentType: normalizedDeclared,
      upsert: true, // idempotente: reprocessar o mesmo mediaId não duplica
    })

  if (uploadError) {
    console.error('[media-handler] Falha no upload Supabase:', uploadError.message)
    return
  }

  // 6. Gerar o URL público permanente dentro do nosso Storage
  const { data: publicUrlData } = adminSupabase.storage
    .from('whatsapp-media')
    .getPublicUrl(storagePath)

  const mediaUrl = publicUrlData?.publicUrl

  if (!mediaUrl) {
    console.error('[media-handler] Falha ao obter URL pública do Storage')
    return
  }

  // 7. Atualizar o registro no banco com a URL definitiva do Storage
  await prisma.waMessage.update({
    where: { id: waMessageDbId },
    data: { mediaUrl, mimeType: normalizedDeclared },
  })

  console.log(`[media-handler] Mídia salva com sucesso: ${storagePath}`)
}

/**
 * Trata casos de MIME compatíveis onde magic bytes e declaração diferem
 * mas representam o mesmo formato (ex: audio/mpeg vs audio/ogg)
 */
function isCompatibleMime(detected: string, declared: string): boolean {
  // Audio MP3: pode ter assinatura ID3 ou frame sync
  if (detected === 'audio/mpeg' && declared === 'audio/mpeg') return true
  // WebP começa com RIFF, mas ambos indicam imagem/webp
  if (detected === 'image/webp' && declared === 'image/webp') return true
  // M4A (audio/mp4) tem mesma assinatura ftyp de video/mp4 — voz de iPhone entra como audio/mp4
  if (detected === 'video/mp4' && declared === 'audio/mp4') return true
  // WebM: EBML header é compartilhado entre audio/webm e video/webm
  if (detected === 'audio/webm' && declared === 'audio/webm') return true
  return false
}
