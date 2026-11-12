import { Suspense } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { LancamentosContent } from './lancamentos-content';
import { APagarContent } from './a-pagar-content';
import { hojeBrasilIso, mesValido } from '@/lib/financeiro/formato-data';
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
        aba?: string;
        mes?: string;
    }>;
}) {
    const params = await searchParams;

    // Auth Check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { lojaAutorizada: true, role: true, lojaPadrao: true },
    });
    if (!dbUser) redirect('/login');

    // Default filters
    const now = new Date();
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]; // Primeiro dia do mês
    const defaultTo = now.toISOString().split('T')[0];

    const from = params.from ?? defaultFrom;
    const to = params.to ?? defaultTo;

    // Compras no cartão / A pagar: só ADMIN e SUPER_ADMIN (papel lido do banco)
    const podeVerAPagar = dbUser.role === 'ADMIN' || dbUser.role === 'SUPER_ADMIN';
    const abaAPagar = podeVerAPagar && params.aba === 'a-pagar';
    const hoje = hojeBrasilIso();
    const mes = mesValido(params.mes) ? params.mes : hoje.slice(0, 7);

    const totalPendentes = podeVerAPagar
        ? await prisma.parcelaCompra.count({
            where: {
                lancamento_id: null,
                cancelada_at: null,
                compra: { cancelado_at: null, ...(dbUser.lojaAutorizada === 'AMBAS' ? {} : { loja: dbUser.lojaAutorizada }) },
            },
        })
        : 0;

    return (
        <div className="flex flex-col h-full bg-muted/20">
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b pb-4 pt-4 px-4 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold tracking-tight">{podeVerAPagar ? 'Lançamentos' : 'Histórico de Lançamentos'}</h1>
                </div>

                {podeVerAPagar && (
                    <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1.5 rounded-xl">
                        <Link
                            href="/lancamentos"
                            scroll={false}
                            className={`py-2.5 rounded-lg text-sm font-semibold text-center transition-all ${!abaAPagar ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            Realizados
                        </Link>
                        <Link
                            href="/lancamentos?aba=a-pagar"
                            scroll={false}
                            className={`py-2.5 rounded-lg text-sm font-semibold text-center transition-all flex items-center justify-center gap-2 ${abaAPagar ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            A pagar
                            {totalPendentes > 0 && (
                                <span className="rounded-full bg-primary/10 text-primary text-xs font-bold px-2 py-0.5">{totalPendentes}</span>
                            )}
                        </Link>
                    </div>
                )}

                {!abaAPagar && (
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
                )}
            </div>

            {abaAPagar ? (
                <Suspense
                    key={`a-pagar-${mes}`}
                    fallback={
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
                            <LancamentoListSkeleton />
                        </div>
                    }
                >
                    <APagarContent mes={mes} hoje={hoje} dbUserLoja={dbUser.lojaAutorizada} />
                </Suspense>
            ) : (
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
            )}
        </div>
    );
}
