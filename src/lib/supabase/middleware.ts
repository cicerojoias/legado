import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
    ROLE_COOKIE_MAX_AGE,
    ROLE_COOKIE_NAME,
    createRoleCookieValue,
    isPinCookieValid,
    pinCookieName,
    readRoleCookie,
} from '@/lib/signed-cookie';

export async function updateSession(request: NextRequest) {
    const mwStart = performance.now();
    let mwRoleMs = 0;
    let supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = NextResponse.next({
                        request,
                    });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // The cron endpoint authenticates with its own bearer secret in the route.
    if (request.nextUrl.pathname === '/api/cron/daily-summary') {
        return supabaseResponse;
    }

    // Valida o JWT localmente (chave assimétrica ES256 via JWKS em cache) e renova a sessão
    // se preciso — sem ida ao Supabase Auth a cada request, ao contrário do getUser().
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ?? null;
    const mwAuthMs = performance.now() - mwStart;

    const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth');
    const isPinRoute = request.nextUrl.pathname.startsWith('/pin') || request.nextUrl.pathname.startsWith('/setup-pin');
    const isResetPasswordRoute = request.nextUrl.pathname.startsWith('/reset-password');

    // Protect all routes: Se não tem usuário e não é rota pública, vai pro login
    if (!userId && !isAuthRoute && !isResetPasswordRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    if (userId) {
        // Cookie do PIN assinado: não basta existir, a assinatura e o userId precisam conferir
        const hasVerifiedPin = isPinCookieValid(request.cookies.get(pinCookieName(userId))?.value, userId);

        // Se está na rota de login mas já está logado
        if (isAuthRoute) {
            const url = request.nextUrl.clone();
            url.pathname = hasVerifiedPin ? '/hoje' : '/pin';
            return NextResponse.redirect(url);
        }

        // Se está tentando acessar uma rota protegida (como /hoje), está logado no Supabase, MAS não validou o PIN
        if (!hasVerifiedPin && !isPinRoute && !isResetPasswordRoute) {
            const url = request.nextUrl.clone();
            url.pathname = '/pin';
            return NextResponse.redirect(url);
        }

        // Se já validou o PIN e tenta acessar a tela de PIN novamente
        if (hasVerifiedPin && isPinRoute) {
            const url = request.nextUrl.clone();
            url.pathname = '/hoje';
            return NextResponse.redirect(url);
        }

        // RBAC: proteger rotas gerenciais por role
        const pathname = request.nextUrl.pathname;
        const isWhatsAppApi = pathname.startsWith('/api/whatsapp/') && !pathname.startsWith('/api/whatsapp/webhook');
        // GERENTE+: lançamentos, inbox e APIs WhatsApp
        const isGerenteRoute = pathname.startsWith('/lancamentos') || pathname.startsWith('/inbox') || isWhatsAppApi;
        // ADMIN+: relatórios
        const isAdminRoute = pathname.startsWith('/relatorios');
        // SUPER_ADMIN apenas
        const isSuperAdminRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/custos-fixos') || pathname.startsWith('/usuarios') || pathname.startsWith('/logs');

        if (hasVerifiedPin && (isGerenteRoute || isAdminRoute || isSuperAdminRoute)) {
            // Role em cache num cookie assinado (10 min) — evita uma query por request.
            // Ações sensíveis continuam validando a role no banco (server actions/rotas).
            let role = readRoleCookie(request.cookies.get(ROLE_COOKIE_NAME)?.value, userId) ?? undefined;
            let freshRole: string | null = null;
            if (!role) {
                const roleStart = performance.now();
                const { data: dbUser } = await supabase
                    .from('users')
                    .select('role')
                    .eq('id', userId)
                    .single();
                mwRoleMs = performance.now() - roleStart;
                role = (dbUser?.role as string | undefined) ?? undefined;
                freshRole = role ?? null;
            }
            const withRoleCookie = (res: NextResponse) => {
                if (freshRole) {
                    res.cookies.set(ROLE_COOKIE_NAME, createRoleCookieValue(userId, freshRole), {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'lax',
                        maxAge: ROLE_COOKIE_MAX_AGE,
                        path: '/',
                    });
                }
                return res;
            };

            if (isGerenteRoute && role !== 'GERENTE' && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
                const url = request.nextUrl.clone();
                url.pathname = '/hoje';
                return withRoleCookie(NextResponse.redirect(url));
            }

            if (isAdminRoute && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
                const url = request.nextUrl.clone();
                url.pathname = '/hoje';
                return withRoleCookie(NextResponse.redirect(url));
            }

            if (isSuperAdminRoute && role !== 'SUPER_ADMIN') {
                const url = request.nextUrl.clone();
                url.pathname = '/hoje';
                return withRoleCookie(NextResponse.redirect(url));
            }

            withRoleCookie(supabaseResponse);
        }
    }

    // Latência do middleware (aparece nos headers da resposta: x-mw-timing)
    supabaseResponse.headers.set(
        'x-mw-timing',
        `auth;dur=${mwAuthMs.toFixed(1)}, role;dur=${mwRoleMs.toFixed(1)}, total;dur=${(performance.now() - mwStart).toFixed(1)}`
    );
    return supabaseResponse;
}
