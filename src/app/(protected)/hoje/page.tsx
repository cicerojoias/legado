import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { DateNavigation } from '@/components/financeiro/date-navigation';
import { LojaHeader } from '@/components/financeiro/loja-header';
import { HojeContent } from '@/components/financeiro/hoje-content';
import { LancamentoListSkeleton } from '@/components/financeiro/lancamento-list-skeleton';
import { Loja } from '@prisma/client';

// Use 'force-dynamic' to ensure fresh data, but Suspense + prefetch handles UX
export const dynamic = 'force-dynamic';

export default async function HojePage({
    searchParams,
}: {
    searchParams: Promise<{ date?: string; loja?: string }>;
}) {
    const params = await searchParams;

    // Auth Check (fast — no fallback UI needed for auth)
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { lojaAutorizada: true, role: true, lojaPadrao: true },
    });

    if (!dbUser) redirect('/login');

    // Determine target Date
    const tzOffset = -3 * 60 * 60 * 1000;
    const localNow = new Date(Date.now() + tzOffset);
    const dateStr = params.date ?? localNow.toISOString().split('T')[0];

    // Determine target Loja (server-side, trusts only session)
    let targetLoja: Loja = dbUser.lojaAutorizada;
    if (
        dbUser.lojaAutorizada === 'AMBAS' &&
        params.loja &&
        (params.loja === 'JOAO_PESSOA' || params.loja === 'SANTA_RITA')
    ) {
        targetLoja = params.loja as Loja;
    } else if (dbUser.lojaAutorizada === 'AMBAS') {
        targetLoja = dbUser.lojaPadrao || 'JOAO_PESSOA';
    }

    return (
        <div className="flex flex-col h-full bg-muted/20">
            {/*
             * The header (LojaHeader + DateNavigation) renders immediately.
             * Only the data-heavy content below is deferred via Suspense,
             * so the navigation arrows are always responsive and feel instant.
             */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b pb-2 pt-4 px-4 shadow-sm">
                <Suspense fallback={null}>
                    <LojaHeader
                        lojaSelecionada={targetLoja}
                        lojaAutorizada={dbUser.lojaAutorizada}
                    />
                    <DateNavigation currentDate={dateStr} />
                </Suspense>
            </div>

            {/*
             * Suspense boundary: on every date navigation, only this region
             * shows the skeleton while waiting; the header above stays intact.
             */}
            <Suspense
                key={`${dateStr}-${targetLoja}`}
                fallback={
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
                        <LancamentoListSkeleton />
                    </div>
                }
            >
                <HojeContent
                    dateStr={dateStr}
                    targetLoja={targetLoja}
                    userId={user.id}
                />
            </Suspense>
        </div>
    );
}
