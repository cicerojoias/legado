import { prisma } from '@/lib/prisma';
import { Loja } from '@prisma/client';
import { MetricaCard } from '@/components/relatorios/metrica-card';
import { RelatoriosChart } from '@/components/relatorios/relatorios-chart';
import { LancamentoList } from '@/components/financeiro/lancamento-list';
import { PeriodoSelect } from '@/components/relatorios/periodo-select';
import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// ─── Helpers de período ───────────────────────────────────────────────────────

function calcPeriod(periodo: string) {
    const now = new Date();
    // Início do dia corrente em UTC
    const todayStart = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    if (periodo === 'hoje') {
        const start = todayStart;
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
        const prevStart = new Date(start.getTime() - 24 * 60 * 60 * 1000);
        const prevEnd = new Date(start.getTime() - 1);
        return { start, end, prevStart, prevEnd };
    }

    if (periodo === 'semana') {
        const start = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);
        const end = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
        const prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
        const prevEnd = new Date(start.getTime() - 1);
        return { start, end, prevStart, prevEnd };
    }

    // 'mes' (padrão) — mês corrente inteiro (dia 1 ao último dia)
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
    return { start, end, prevStart, prevEnd };
}

function buildLojaWhere(loja: string, dbUserLoja: Loja) {
    if (loja !== 'TODAS' && (loja === 'JOAO_PESSOA' || loja === 'SANTA_RITA')) {
        if (dbUserLoja === 'AMBAS' || dbUserLoja === loja) {
            return { loja: loja as Loja };
        }
    }
    if (dbUserLoja !== 'AMBAS') {
        return { loja: dbUserLoja };
    }
    return {};
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
    loja: string;
    periodo: string;
    dbUserLoja: Loja;
    userId: string;
}

export async function RelatoriosContent({ loja, periodo, dbUserLoja, userId }: Props) {
    const { start, end, prevStart, prevEnd } = calcPeriod(periodo);
    const lojaWhere = buildLojaWhere(loja, dbUserLoja);
    const baseWhere = { deletado_at: null, ...lojaWhere };

    const [stats, prevStats] = await Promise.all([
        prisma.lancamento.groupBy({
            by: ['tipo'],
            where: { ...baseWhere, data_ref: { gte: start, lte: end } },
            _sum: { valor: true },
        }),
        prisma.lancamento.groupBy({
            by: ['tipo'],
            where: { ...baseWhere, data_ref: { gte: prevStart, lte: prevEnd } },
            _sum: { valor: true },
        }),
    ]);

    const [chartLancamentos, lancamentos, totalLancamentos] = await Promise.all([
        // Busca todos os lançamentos do período apenas com os campos necessários para o gráfico
        prisma.lancamento.findMany({
            where: { ...baseWhere, data_ref: { gte: start, lte: end } },
            select: { data_ref: true, tipo: true, valor: true },
        }),
        // Busca os últimos 10 lançamentos completos para a lista
        prisma.lancamento.findMany({
            where: { ...baseWhere, data_ref: { gte: start, lte: end } },
            orderBy: { data_ref: 'desc' },
            take: 10,
            include: { usuario: { select: { nome: true } } },
        }),
        // Conta o total absoluto de lançamentos no período
        prisma.lancamento.count({
            where: { ...baseWhere, data_ref: { gte: start, lte: end } },
        }),
    ]);


    const totalEntradas = Number(stats.find((s) => s.tipo === 'ENTRADA')?._sum.valor ?? 0);
    const totalSaidas = Number(stats.find((s) => s.tipo === 'SAIDA')?._sum.valor ?? 0);
    const saldo = totalEntradas - totalSaidas;

    const prevEntradas = Number(prevStats.find((s) => s.tipo === 'ENTRADA')?._sum.valor ?? 0);
    const prevSaidas = Number(prevStats.find((s) => s.tipo === 'SAIDA')?._sum.valor ?? 0);

    const varEntradas =
        prevEntradas > 0 ? ((totalEntradas - prevEntradas) / prevEntradas) * 100 : null;
    const varSaidas =
        prevSaidas > 0 ? ((totalSaidas - prevSaidas) / prevSaidas) * 100 : null;

    // Agrega os dados para o gráfico
    const chartData: { date: string; dateRange?: string; entradas: number; saidas: number }[] = [];

    if (periodo === 'mes') {
        const weeksCount = 5;
        const lastDayStr = end.toISOString().split('T')[0].split('-')[2];
        const lastDay = Number(lastDayStr);

        const getRange = (i: number) => {
            if (i === 1) return '(01-07)';
            if (i === 2) return '(08-14)';
            if (i === 3) return '(15-21)';
            if (i === 4) return '(22-28)';
            return `(29-${lastDay.toString().padStart(2, '0')})`;
        };

        // Inicia 5 semanas com valores zerados
        for (let i = 1; i <= weeksCount; i++) {
            chartData.push({ date: `Sem. ${i}`, dateRange: getRange(i), entradas: 0, saidas: 0 });
        }

        for (const l of chartLancamentos) {
            const dateStr = l.data_ref.toISOString().split('T')[0] as string; // YYYY-MM-DD
            const dayStr = dateStr.split('-')[2];
            if (!dayStr) continue;

            const day = Number(dayStr);
            let weekIndex = 0; // 0-based for array index

            if (day >= 1 && day <= 7) weekIndex = 0;
            else if (day >= 8 && day <= 14) weekIndex = 1;
            else if (day >= 15 && day <= 21) weekIndex = 2;
            else if (day >= 22 && day <= 28) weekIndex = 3;
            else weekIndex = 4; // 29, 30, 31

            const entry = chartData[weekIndex];
            if (entry) {
                if (l.tipo === 'ENTRADA') entry.entradas += Number(l.valor);
                else entry.saidas += Number(l.valor);
            }
        }
    } else {
        const dailyMap = new Map<string, { entradas: number; saidas: number }>();
        // Inicializa todos os dias do período com zero
        let current = new Date(start.getTime());
        while (current <= end) {
            const dayStr = current.toISOString().split('T')[0];
            dailyMap.set(dayStr, { entradas: 0, saidas: 0 });
            current.setDate(current.getDate() + 1);
        }

        for (const l of chartLancamentos) {
            const day = l.data_ref.toISOString().split('T')[0] as string;
            if (dailyMap.has(day)) {
                const entry = dailyMap.get(day)!;
                if (l.tipo === 'ENTRADA') entry.entradas += Number(l.valor);
                else entry.saidas += Number(l.valor);
            }
        }

        const sortedDays = Array.from(dailyMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, values]) => ({ date, ...values }));

        chartData.push(...sortedDays);
    }

    const serialized = lancamentos.map((l) => ({ ...l, valor: Number(l.valor) }));

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
            {/* Filtro de Período */}
            <Suspense fallback={<div className="h-9 w-full bg-muted rounded-lg animate-pulse" />}>
                <PeriodoSelect current={periodo} />
            </Suspense>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2">
                <MetricaCard label="Entradas" value={totalEntradas} variacao={varEntradas} tipo="entrada" />
                <MetricaCard label="Saídas" value={totalSaidas} variacao={varSaidas} tipo="saida" />
                <MetricaCard label="Saldo" value={saldo} variacao={null} tipo="saldo" />
            </div>

            {/* Gráfico */}
            {chartData.length > 0 && <RelatoriosChart data={chartData} periodo={periodo} />}

            {/* Lista */}
            <div className="pt-1">
                <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide mb-3 ml-1 flex items-center justify-between">
                    <span>
                        Lançamentos{totalLancamentos > 0 ? ` (${totalLancamentos})` : ''}
                    </span>
                    {totalLancamentos > 10 && (
                        <span className="text-muted-foreground/60 text-[10px] uppercase">
                            MOSTRANDO OS 10 RECENTES
                        </span>
                    )}
                </p>

                {serialized.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">
                        Nenhum lançamento neste período.
                    </div>
                ) : (
                    <LancamentoList
                        lancamentos={serialized}
                        currentUserId={userId}
                        showDate={true}
                    />
                )}

                {totalLancamentos > 10 && (
                    <div className="pt-2 pb-6 flex justify-center">
                        <Link
                            href="/lancamentos"
                            className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 hover:bg-muted hover:text-foreground h-10 px-4 py-2 text-muted-foreground w-full border border-dashed border-border/60"
                        >
                            Ver todos os {totalLancamentos} lançamentos
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
