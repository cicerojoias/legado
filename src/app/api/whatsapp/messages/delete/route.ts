import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rate-limit'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = await rateLimit(`wa-delete:${user.id}`, 10, 15)
  if (!rl.success) {
    return NextResponse.json({ error: rl.message }, { status: 429 })
  }

  // Cloud API não oferece exclusão de mensagens enviadas. Mantém uma resposta
  // explícita para clientes antigos, sem chamar a Meta ou alterar o histórico.
  return NextResponse.json({
    code: 'WHATSAPP_DELETE_UNSUPPORTED',
    error: 'A integração com o WhatsApp não permite apagar mensagens já enviadas. A mensagem continua na conversa do cliente.',
    deleted: 0,
  }, { status: 501 })
}
