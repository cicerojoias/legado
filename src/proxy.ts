import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// Next 16: proxy roda em Node.js na região das funções (pdx1, junto do Supabase).
// O antigo middleware.ts rodava em Edge na borda do usuário (gru1) e cada chamada
// ao Supabase cruzava o continente.
export async function proxy(request: NextRequest) {
    // updateSession already handles token refresh and redirects if the user
    // doesn't have a session and tries to access a protected route
    return await updateSession(request)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - manifest.json / sw.js: o browser busca sem cookies; redirecionar para /login quebra o PWA
         * Feel free to modify this pattern to include more paths.
         */
        '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|api/whatsapp/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
