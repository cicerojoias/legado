import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'

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
  } catch (err: any) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
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
 * Retorna o corpo da resposta em formato ReadableStream para o browser e o tipo de conteúdo
 */
export async function getFileFromR2(key: string): Promise<{ body: ReadableStream | null; contentType?: string } | null> {
  if (!s3Client || !bucketName) return null
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
    const response = await s3Client.send(command)
    
    // O SDK S3 v3 provê transformToWebStream() no Node e em runtimes edge
    const body = response.Body && typeof (response.Body as any).transformToWebStream === 'function'
      ? (response.Body as any).transformToWebStream()
      : (response.Body as any)

    return {
      body,
      contentType: response.ContentType,
    }
  } catch (err) {
    console.error(`[r2-client] Erro ao obter arquivo ${key} do R2:`, err)
    return null
  }
}
