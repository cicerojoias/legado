import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { LojaFilter } from '@/components/relatorios/loja-filter';
import { RelatoriosContent } from './relatorios-content';

interface SearchParams {
    loja?: string;
    periodo?: string;
}

function RelatoriosSkeleton() {
    return (
        <div className="p-4 space-y-4">
            {/* Skeleton do Filtro de Período (agora no body) */}
            <div className="w-full">
                <div className="h-9 w-full bg-muted rounded-lg animate-pulse" />
            </div>

            <div className="grid grid-cols-3 gap-2">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[88px] bg-muted rounded-xl border border-muted animate-pulse" />
                ))}
            </div>

            {/* Gráfico */}
            <div className="h-[200px] bg-muted rounded-xl border border-muted animate-pulse" />

            {/* Lista de Lançamentos */}
            <div className="space-y-3">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-[82px] bg-muted rounded-2xl animate-pulse" />
                ))}
            </div>
        </div>
    );
}

export default async function RelatoriosPage({
    searchParams,
}: {
    searchParams: Promise<SearchParams>;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, lojaAutorizada: true, lojaPadrao: true, ativo: true },
    });

    if (!dbUser || !dbUser.ativo) redirect('/login');
    if (dbUser.role === 'OPERADOR') redirect('/hoje');

    const params = await searchParams;
    const defaultLoja = dbUser.lojaAutorizada === 'AMBAS'
        ? (dbUser.lojaPadrao ?? 'TODAS')
        : dbUser.lojaAutorizada;
        
    const loja = params.loja ?? defaultLoja;
    const periodo = params.periodo ?? 'mes';

    return (
        <div className="flex flex-col h-full overflow-x-hidden w-full max-w-full">
            {/* Header com filtros */}
            <div className="px-4 pt-4 pb-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-lg font-semibold mb-3">Relatórios</h1>
                <div className="flex justify-center w-full">
                    <Suspense fallback={<div className="h-7 w-32 shrink-0 bg-muted rounded-lg animate-pulse" />}>
                        <LojaFilter current={loja} />
                    </Suspense>
                </div>
            </div>

            {/* Conteúdo com Suspense — key força remount ao trocar filtros */}
            <Suspense key={`${loja}-${periodo}`} fallback={<RelatoriosSkeleton />}>
                <RelatoriosContent
                    loja={loja}
                    periodo={periodo}
                    dbUserLoja={dbUser.lojaAutorizada}
                    userId={user.id}
                />
            </Suspense>
        </div>
    );
}
