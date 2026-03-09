import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { SaldoCard, SaldoCardSkeleton } from '@/components/dashboard/saldo-card';
import { EntradaSaidaChart } from '@/components/dashboard/entrada-saida-chart';
import { RecentesTable } from '@/components/dashboard/recentes-table';

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchDashboardData() {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endOfToday   = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );
    const thirtyDaysAgo = new Date(endOfToday.getTime() - 30 * 24 * 60 * 60 * 1000);

    const baseWhere = { deletado_at: null };

    const [statsMes, statsJP, statsSR, lancamentos30d, recentes] = await Promise.all([
        // Mês corrente — consolidado
        prisma.lancamento.groupBy({
            by: ['tipo'],
            where: { ...baseWhere, data_ref: { gte: startOfMonth, lte: endOfToday } },
            _sum: { valor: true },
        }),
        // Mês corrente — JP
        prisma.lancamento.groupBy({
            by: ['tipo'],
            where: { ...baseWhere, loja: 'JOAO_PESSOA', data_ref: { gte: startOfMonth, lte: endOfToday } },
            _sum: { valor: true },
        }),
        // Mês corrente — SR
        prisma.lancamento.groupBy({
            by: ['tipo'],
            where: { ...baseWhere, loja: 'SANTA_RITA', data_ref: { gte: startOfMonth, lte: endOfToday } },
            _sum: { valor: true },
        }),
        // 30 dias para o gráfico
        prisma.lancamento.findMany({
            where: { ...baseWhere, data_ref: { gte: thirtyDaysAgo, lte: endOfToday } },
            select: { tipo: true, valor: true, data_ref: true },
            orderBy: { data_ref: 'asc' },
        }),
        // Últimos 20 para a tabela
        prisma.lancamento.findMany({
            where: baseWhere,
            orderBy: { data_ref: 'desc' },
            take: 20,
            include: { usuario: { select: { nome: true } } },
        }),
    ]);

    // Saldo consolidado do mês
    const mesEntradas = Number(statsMes.find((s) => s.tipo === 'ENTRADA')?._sum.valor ?? 0);
    const mesSaidas   = Number(statsMes.find((s) => s.tipo === 'SAIDA')?._sum.valor   ?? 0);

    // JP
    const jpEntradas = Number(statsJP.find((s) => s.tipo === 'ENTRADA')?._sum.valor ?? 0);
    const jpSaidas   = Number(statsJP.find((s) => s.tipo === 'SAIDA')?._sum.valor   ?? 0);

    // SR
    const srEntradas = Number(statsSR.find((s) => s.tipo === 'ENTRADA')?._sum.valor ?? 0);
    const srSaidas   = Number(statsSR.find((s) => s.tipo === 'SAIDA')?._sum.valor   ?? 0);

    // Agrega por dia para o gráfico
    const dailyMap = new Map<string, { entradas: number; saidas: number }>();
    for (const l of lancamentos30d) {
        const day = l.data_ref.toISOString().split('T')[0] as string;
        if (!dailyMap.has(day)) dailyMap.set(day, { entradas: 0, saidas: 0 });
        const entry = dailyMap.get(day)!;
        if (l.tipo === 'ENTRADA') entry.entradas += Number(l.valor);
        else entry.saidas += Number(l.valor);
    }
    const chartData = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, values]) => ({ date, ...values }));

    const recentesSerializados = recentes.map((l) => ({ ...l, valor: Number(l.valor) }));

    return {
        mes:     { entradas: mesEntradas, saidas: mesSaidas },
        jp:      { entradas: jpEntradas,  saidas: jpSaidas  },
        sr:      { entradas: srEntradas,  saidas: srSaidas  },
        chartData,
        recentes: recentesSerializados,
    };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
    return (
        <div className="p-6 space-y-6 max-w-6xl">
            <div className="grid grid-cols-3 gap-4">
                {[0, 1, 2].map((i) => <SaldoCardSkeleton key={i} />)}
            </div>
            <div className="h-72 bg-muted rounded-xl animate-pulse" />
            <div className="h-64 bg-muted rounded-xl animate-pulse" />
        </div>
    );
}

// ─── Content ──────────────────────────────────────────────────────────────────

async function DashboardContent() {
    const data = await fetchDashboardData();

    return (
        <div className="p-6 space-y-6 max-w-6xl">
            {/* Saldo cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SaldoCard
                    label="Consolidado — Mês Atual"
                    entradas={data.mes.entradas}
                    saidas={data.mes.saidas}
                    destaque
                />
                <SaldoCard
                    label="João Pessoa — Mês Atual"
                    entradas={data.jp.entradas}
                    saidas={data.jp.saidas}
                />
                <SaldoCard
                    label="Santa Rita — Mês Atual"
                    entradas={data.sr.entradas}
                    saidas={data.sr.saidas}
                />
            </div>

            {/* Gráfico 30 dias */}
            {data.chartData.length > 0 && (
                <EntradaSaidaChart data={data.chartData} />
            )}

            {/* Tabela recentes */}
            <RecentesTable lancamentos={data.recentes} />
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
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
        <div className="flex flex-col h-full overflow-y-auto">
            <div className="px-6 pt-6 pb-4 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-xl font-semibold">Dashboard</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Visão geral do mês — {new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(new Date())}
                </p>
            </div>

            <Suspense fallback={<DashboardSkeleton />}>
                <DashboardContent />
            </Suspense>
        </div>
    );
}
