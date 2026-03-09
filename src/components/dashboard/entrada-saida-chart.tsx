'use client';

import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, CartesianGrid } from 'recharts';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
    type ChartConfig,
} from '@/components/ui/chart';

export interface DailyData {
    date: string;
    entradas: number;
    saidas: number;
}

const chartConfig = {
    entradas: { label: 'Entradas', color: '#184434' },
    saidas:   { label: 'Saídas',   color: '#B54040' },
} satisfies ChartConfig;

const formatDay = (dateStr: string) => {
    const [, month, day] = dateStr.split('-');
    return `${day}/${month}`;
};

const formatCompact = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);

export function EntradaSaidaChart({ data }: { data: DailyData[] }) {
    return (
        <div className="bg-card rounded-xl border border-border p-5">
            <p className="text-sm font-semibold mb-1">Entradas vs Saídas</p>
            <p className="text-xs text-muted-foreground mb-4">Últimos 30 dias</p>
            <ChartContainer config={chartConfig} className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} barCategoryGap="30%" margin={{ left: -8, right: 8, top: 4, bottom: 0 }}>
                        <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.06)" />
                        <XAxis
                            dataKey="date"
                            tickFormatter={formatDay}
                            tick={{ fontSize: 10, fill: '#6B6358' }}
                            axisLine={false}
                            tickLine={false}
                            interval="preserveStartEnd"
                        />
                        <YAxis
                            tickFormatter={formatCompact}
                            tick={{ fontSize: 10, fill: '#6B6358' }}
                            axisLine={false}
                            tickLine={false}
                            width={56}
                        />
                        <ChartTooltip
                            content={<ChartTooltipContent />}
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                        />
                        <ChartLegend content={<ChartLegendContent />} />
                        <Bar dataKey="entradas" fill="#184434" radius={[4, 4, 0, 0]} maxBarSize={24} />
                        <Bar dataKey="saidas"   fill="#B54040" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                </ResponsiveContainer>
            </ChartContainer>
        </div>
    );
}
