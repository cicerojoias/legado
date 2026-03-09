import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Loja } from '@prisma/client';
import { LancamentosContent } from './lancamentos-content';
import { LancamentoListSkeleton } from '@/components/financeiro/lancamento-list-skeleton';
import { FilterBar } from './filter-bar';

export const dynamic = 'force-dynamic';

export default async function LancamentosPage({
    searchParams,
}: {
    searchParams: Promise<{
        from?: string;
        to?: string;
        loja?: string;
        tipo?: string;
    }>;
}) {
    const params = await searchParams;

    // Auth Check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { lojaAutorizada: true, role: true },
    });
    if (!dbUser) redirect('/login');

    // Default filters
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; // Primeiro dia do mês
    const defaultTo = now.toISOString().split('T')[0];

    const from = params.from ?? defaultFrom;
    const to = params.to ?? defaultTo;

    // Determine allowed loja
    let targetLoja: Loja | 'TODAS' = dbUser.lojaAutorizada === 'AMBAS' ? (params.loja as any ?? 'AMBAS') : dbUser.lojaAutorizada;
    if (dbUser.lojaAutorizada !== 'AMBAS') {
        targetLoja = dbUser.lojaAutorizada;
    }

    return (
        <div className="flex flex-col h-full bg-muted/20">
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b pb-4 pt-4 px-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold tracking-tight">Histórico de Lançamentos</h1>
                </div>

                <Suspense fallback={null}>
                    <FilterBar
                        initialFilters={{
                            from,
                            to,
                            loja: params.loja,
                            tipo: params.tipo
                        }}
                        lojaAutorizada={dbUser.lojaAutorizada}
                    />
                </Suspense>
            </div>

            <Suspense
                key={`${from}-${to}-${params.loja}-${params.tipo}`}
                fallback={
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
                        <LancamentoListSkeleton />
                    </div>
                }
            >
                <LancamentosContent
                    from={from}
                    to={to}
                    loja={params.loja}
                    tipo={params.tipo}
                    dbUserLoja={dbUser.lojaAutorizada}
                    userId={user.id}
                />
            </Suspense>
        </div>
    );
}
