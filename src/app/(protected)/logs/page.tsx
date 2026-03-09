import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { LogsFilters } from './logs-filters';
import { LogsContent } from './logs-content';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchParams {
    usuario?: string;
    acao?: string;
    page?: string;
}

// ─── Skeleton ───────────────────────────────────────────────────────────────

function LogsSkeleton() {
    return (
        <div className="p-4 space-y-3">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
        </div>
    );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function LogsPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, ativo: true },
    });

    if (!dbUser || !dbUser.ativo) redirect('/login');
    if (dbUser.role !== 'SUPER_ADMIN') redirect('/hoje');

    // Fetch users list for filter dropdown
    const usuarios = await prisma.user.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
    });

    const params = await searchParams;
    const usuario = params.usuario ?? '';
    const acao = params.acao ?? '';
    const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 pt-4 pb-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10 space-y-3">
                <div>
                    <h1 className="text-lg font-semibold">Logs</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Histórico de atividades do sistema
                    </p>
                </div>

                {/* Filters — useSearchParams → Suspense obrigatório */}
                <Suspense fallback={<div className="flex gap-2"><div className="flex-1 h-9 bg-muted rounded-lg animate-pulse" /><div className="flex-1 h-9 bg-muted rounded-lg animate-pulse" /></div>}>
                    <LogsFilters usuarios={usuarios} />
                </Suspense>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
                {/* Content — key forces remount on filter/page change */}
                <Suspense key={`${usuario}-${acao}-${page}`} fallback={<LogsSkeleton />}>
                    <LogsContent usuario={usuario} acao={acao} page={page} />
                </Suspense>
            </div>
        </div>
    );
}
