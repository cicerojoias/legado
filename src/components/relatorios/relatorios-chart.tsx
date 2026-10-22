'use client';

import dynamic from 'next/dynamic';
import type { ChartDataPoint } from './relatorios-chart-barras';

export type { ChartDataPoint };

// O gráfico (Recharts, ~100 KB) carrega depois dos números (P3).
// O espaço já fica reservado na altura certa para a tela não pular.
const RelatoriosBarras = dynamic(
    () => import('./relatorios-chart-barras').then((m) => m.RelatoriosBarras),
    { ssr: false, loading: () => <div className="h-full w-full rounded-lg bg-muted/40 animate-pulse" /> }
);

export function RelatoriosChart({ data, periodo }: { data: ChartDataPoint[]; periodo?: string }) {
    const isSemana = periodo === 'semana';
    const isAno = periodo === 'ano';

    const chartTitle = isAno ? 'Entradas vs Saídas por Mês' : 'Entradas vs Saídas por Dia';
    const barras = (
        <div className={isSemana ? 'h-44 w-full' : 'h-40 w-full'}>
            <RelatoriosBarras data={data} periodo={periodo} />
        </div>
    );

    return (
        <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide mb-3">
                {chartTitle}
            </p>
            {isAno ? (
                <div className="w-full overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-border">
                    <div className="min-w-[600px] h-40">
                        {barras}
                    </div>
                </div>
            ) : (
                barras
            )}
        </div>
    );
}
