import { prisma } from '@/lib/prisma'
import { downloadMediaBuffer } from './meta-client'
import { checkFileExistsInR2, uploadMediaToR2, isR2Configured } from './r2-client'

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

/**
 * Retorna a chave do objeto no R2 com base no mediaId e mimeType
 */
export function getR2Key(mediaId: string, mimeType: string): string {
  const normalizedMime = (mimeType || 'application/octet-stream').split(';')[0].trim()
  const ext = ALLOWED_MIME_MAP[normalizedMime] ?? 'bin'
  return `wab-media/${mediaId}.${ext}`
}

/**
 * Baixa uma mídia da Meta e persiste no Cloudflare R2 de forma idempotente.
 *
 * @param mediaId ID da mídia do WhatsApp
 * @param mimeType MIME type da mídia
 * @returns true se foi persistida com sucesso, false caso contrário
 */
export async function persistMediaToR2(mediaId: string, mimeType: string): Promise<boolean> {
  if (!isR2Configured()) {
    console.warn('[media-uploader] R2 não está configurado.')
    return false
  }

  const normalizedMime = (mimeType || 'application/octet-stream').split(';')[0].trim()
  const key = getR2Key(mediaId, normalizedMime)

  try {
    // 1. Verificar se já existe no R2 para evitar downloads desnecessários
    const exists = await checkFileExistsInR2(key)
    if (exists) {
      console.log(`[media-uploader] Mídia ${mediaId} já existe no R2. Pulando upload.`)
      await updateMediaUrlInDatabase(mediaId, `/api/whatsapp/media/${mediaId}`)
      return true
    }

    // 2. Fazer download do buffer binário a partir da Meta API
    console.log(`[media-uploader] Baixando mídia ${mediaId} da Meta...`)
    const buffer = await downloadMediaBuffer(mediaId)

    // 3. Fazer upload para o Cloudflare R2
    console.log(`[media-uploader] Fazendo upload da mídia ${mediaId} para o R2...`)
    const success = await uploadMediaToR2(key, buffer, normalizedMime)

    if (success) {
      // 4. Atualizar o banco de dados
      await updateMediaUrlInDatabase(mediaId, `/api/whatsapp/media/${mediaId}`)
      return true
    }

    return false
  } catch (err) {
    console.error(`[media-uploader] Erro ao persistir mídia ${mediaId} no R2:`, err)
    return false
  }
}

async function updateMediaUrlInDatabase(mediaId: string, mediaUrl: string) {
  try {
    const result = await prisma.waMessage.updateMany({
      where: { mediaId },
      data: { mediaUrl },
    })
    if (result.count > 0) {
      console.log(`[media-uploader] Atualizadas ${result.count} mensagens no banco com a URL: ${mediaUrl}`)
    }
  } catch (err) {
    console.error(`[media-uploader] Erro ao atualizar banco de dados para mediaId ${mediaId}:`, err)
  }
}
