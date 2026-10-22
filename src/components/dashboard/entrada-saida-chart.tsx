'use client';

import dynamic from 'next/dynamic';
import type { DailyData } from './entrada-saida-chart-barras';

export type { DailyData };

// O gráfico (Recharts, ~100 KB) carrega depois dos números (P3).
// O espaço já fica reservado na altura certa para a tela não pular.
const EntradaSaidaBarras = dynamic(
    () => import('./entrada-saida-chart-barras').then((m) => m.EntradaSaidaBarras),
    { ssr: false, loading: () => <div className="h-56 w-full rounded-lg bg-muted/40 animate-pulse" /> }
);

export function EntradaSaidaChart({ data }: { data: DailyData[] }) {
    return (
        <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-sm font-semibold mb-1">Entradas vs Saídas</p>
            <p className="text-xs text-muted-foreground mb-4">Últimos 30 dias</p>
            <EntradaSaidaBarras data={data} />
        </div>
    );
}
