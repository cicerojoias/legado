import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

type S3Error = {
  name?: string
  $metadata?: { httpStatusCode?: number }
}

const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY
const endpoint = process.env.CLOUDFLARE_R2_ENDPOINT
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME

const isConfigured = !!(accessKeyId && secretAccessKey && endpoint && bucketName)

export const s3Client = isConfigured
  ? new S3Client({
      region: 'auto',
      endpoint: endpoint!,
      credentials: {
        accessKeyId: accessKeyId!,
        secretAccessKey: secretAccessKey!,
      },
    })
  : null

export function isR2Configured(): boolean {
  return isConfigured
}

export function getR2BucketName(): string | undefined {
  return bucketName
}

/**
 * Verifica se um arquivo com a chave especificada existe no bucket R2
 */
export async function checkFileExistsInR2(key: string): Promise<boolean> {
  if (!s3Client || !bucketName) return false
  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
    await s3Client.send(command)
    return true
  } catch (err: unknown) {
    const s3Error = err as S3Error
    if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
      return false
    }
    console.error(`[r2-client] Erro ao verificar existência de ${key}:`, err)
    return false
  }
}

/**
 * Faz upload de um buffer binário para o R2 com a chave e MIME type fornecidos
 */
export async function uploadMediaToR2(
  key: string,
  buffer: Buffer,
  mimeType: string
): Promise<boolean> {
  if (!s3Client || !bucketName) {
    console.warn('[r2-client] R2 não está configurado. Upload ignorado.')
    return false
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    })
    await s3Client.send(command)
    console.log(`[r2-client] Upload concluído com sucesso para ${key}`)
    return true
  } catch (err) {
    console.error(`[r2-client] Falha ao fazer upload para ${key}:`, err)
    return false
  }
}

/**
 * Retorna o corpo da resposta em formato ReadableStream para o browser e o tipo de conteúdo.
 * Aceita um header Range opcional (ex: "bytes=0-1023") — iOS/Safari exige resposta
 * 206 Partial Content para reproduzir <video>/<audio>, então o proxy repassa o Range.
 */
export async function getFileFromR2(
  key: string,
  range?: string
): Promise<{
  body: ReadableStream | null
  contentType?: string
  contentLength?: number
  contentRange?: string
  partial: boolean
} | null> {
  if (!s3Client || !bucketName) return null
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
      ...(range ? { Range: range } : {}),
    })
    const response = await s3Client.send(command)

    // O SDK S3 v3 provê transformToWebStream() no Node e em runtimes edge
    const body = response.Body?.transformToWebStream?.() ?? null

    return {
      body,
      contentType: response.ContentType,
      contentLength: response.ContentLength,
      contentRange: response.ContentRange,
      partial: !!response.ContentRange,
    }
  } catch (err: unknown) {
    // Range inválido (fora do tamanho do objeto): tenta novamente sem Range
    const s3Error = err as S3Error
    if (range && s3Error.$metadata?.httpStatusCode === 416) {
      return getFileFromR2(key)
    }
    console.error(`[r2-client] Erro ao obter arquivo ${key} do R2:`, err)
    return null
  }
}
