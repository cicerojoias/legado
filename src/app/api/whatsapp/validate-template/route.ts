import { validateTemplate } from '@/lib/whatsapp/meta-client'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  try {
    const body = (await req.json()) as {
      templateName: string
      languageCode: string
    }
    const { templateName, languageCode } = body

    if (!templateName || !languageCode) {
      return Response.json(
        { error: 'templateName e languageCode são obrigatórios' },
        { status: 400 }
      )
    }

    const isValid = await validateTemplate(templateName, languageCode)

    return Response.json({
      isValid,
      templateName,
      languageCode,
      message: isValid
        ? 'Template aprovado e disponível'
        : 'Template não encontrado ou não aprovado',
    })
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[validate-template] Erro:', err)
    return Response.json(
      { error: 'Erro ao validar template', details: err.message },
      { status: 500 }
    )
  }
}
