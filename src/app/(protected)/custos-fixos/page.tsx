import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { CustoFixoList } from '@/components/custos-fixos/custo-fixo-list';

function CustosSkeleton() {
    return (
        <div className="p-4 space-y-3">
            <div className="h-24 bg-muted rounded-xl animate-pulse" />
            <div className="h-12 bg-muted rounded-xl animate-pulse" />
            {[0, 1, 2].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
            ))}
        </div>
    );
}

async function CustosContent() {
    const custos = await prisma.custoFixo.findMany({
        orderBy: [{ ativo: 'desc' }, { loja: 'asc' }, { nome: 'asc' }],
    });

    const serialized = custos.map((c) => ({
        ...c,
        valor: Number(c.valor),
        loja: c.loja as 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS',
    }));

    const totalMensal = serialized
        .filter((c) => c.ativo)
        .reduce((sum, c) => sum + c.valor, 0);

    return <CustoFixoList custos={serialized} totalMensal={totalMensal} />;
}

export default async function CustosFixosPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, ativo: true },
    });

    if (!dbUser || !dbUser.ativo) redirect('/login');
    if (dbUser.role !== 'SUPER_ADMIN') redirect('/hoje');

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 pt-4 pb-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-lg font-semibold">Custos Fixos</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Custos mensais recorrentes de ambas as lojas
                </p>
            </div>

            <Suspense fallback={<CustosSkeleton />}>
                <CustosContent />
            </Suspense>
        </div>
    );
}
