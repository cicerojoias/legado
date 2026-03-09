import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
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

    // Refreshing the auth token
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const isAuthRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth');
    const isSandboxRoute = request.nextUrl.pathname.startsWith('/sandbox');
    const isPinRoute = request.nextUrl.pathname.startsWith('/pin') || request.nextUrl.pathname.startsWith('/setup-pin');

    // Protect all routes: Se não tem usuário e não é rota pública, vai pro login
    if (!user && !isAuthRoute && !isSandboxRoute) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    if (user) {
        const pinCookieName = `pin_verified_${user.id}`;
        const hasVerifiedPin = request.cookies.has(pinCookieName);

        // Se está na rota de login mas já está logado
        if (isAuthRoute) {
            const url = request.nextUrl.clone();
            url.pathname = hasVerifiedPin ? '/hoje' : '/pin';
            return NextResponse.redirect(url);
        }

        // Se está tentando acessar uma rota protegida (como /hoje), está logado no Supabase, MAS não validou o PIN
        if (!hasVerifiedPin && !isPinRoute && !isSandboxRoute) {
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
        const isAdminRoute = pathname.startsWith('/relatorios') || pathname.startsWith('/lancamentos');
        const isSuperAdminRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/custos-fixos') || pathname.startsWith('/usuarios') || pathname.startsWith('/logs');

        if (hasVerifiedPin && (isAdminRoute || isSuperAdminRoute)) {
            const { data: dbUser } = await supabase
                .from('users')
                .select('role')
                .eq('id', user.id)
                .single();

            const role = dbUser?.role as string | undefined;

            if (isAdminRoute && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
                const url = request.nextUrl.clone();
                url.pathname = '/hoje';
                return NextResponse.redirect(url);
            }

            if (isSuperAdminRoute && role !== 'SUPER_ADMIN') {
                const url = request.nextUrl.clone();
                url.pathname = '/hoje';
                return NextResponse.redirect(url);
            }
        }
    }

    return supabaseResponse;
}
