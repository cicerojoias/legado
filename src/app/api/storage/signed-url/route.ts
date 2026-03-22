import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'whatsapp-media'
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
const MAX_BYTES = 16 * 1024 * 1024 // 16 MB (limite WhatsApp)
const URL_TTL_SECONDS = 120 // 2 min para completar o upload

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  // Verifica sessão usando o cliente server do Supabase (substitui o @/lib/auth inexistente)
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const body = (await req.json()) as { mimeType?: string; fileName?: string }
  const { mimeType, fileName } = body

  if (!mimeType || !ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 400 })
  }

  // Gera nome único para evitar colisões e path traversal
  // ext limitado a 4 chars: previne path corruption quando fileName não tem extensão (file-uploads skill)
  const rawExt = (fileName ?? 'file').split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') ?? 'bin'
  const ext = rawExt.slice(0, 4)
  const storagePath = `outbound/${Date.now()}-${crypto.randomUUID()}.${ext}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error || !data) {
    console.error('[signed-url] Supabase error:', error)
    return NextResponse.json({ error: 'Falha ao gerar URL de upload' }, { status: 500 })
  }

  // Guard: falha explícita se env var ausente (evita URL "undefined/storage/...")
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) {
    console.error('[signed-url] NEXT_PUBLIC_SUPABASE_URL não configurada')
    return NextResponse.json({ error: 'Configuração de servidor inválida' }, { status: 500 })
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    publicUrl,
    ttl: URL_TTL_SECONDS,
  })
}
