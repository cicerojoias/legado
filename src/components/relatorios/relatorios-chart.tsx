'use client';

import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    type ChartConfig,
} from '@/components/ui/chart';

export interface ChartDataPoint {
    date: string;
    dateRange?: string;
    entradas: number;
    saidas: number;
}

const chartConfig = {
    entradas: { label: 'Entradas', color: '#184434' },
    saidas: { label: 'Saídas', color: '#B54040' },
} satisfies ChartConfig;

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const formatDay = (dateStr: string) => {
    const parts = dateStr.split('-');
    return parts[2] ?? dateStr;
};

const MesTick = ({ x, y, payload, data }: any) => {
    const dateStr = payload?.value ?? '';
    const entry = data.find((d: any) => d.date === dateStr);
    const dateRange = entry?.dateRange ?? '';

    return (
        <g transform={`translate(${x ?? 0},${y ?? 0})`}>
            <text x={0} y={0} dy={10} textAnchor="middle" fontSize={10} fill="#6B6358">{dateStr}</text>
            {dateRange && <text x={0} y={0} dy={22} textAnchor="middle" fontSize={9} fill="#C79A34">{dateRange}</text>}
        </g>
    );
};

function SemanaTick({ x, y, payload }: { x?: number; y?: number; payload?: { value: string } }) {
    const parts = (payload?.value ?? '').split('-');
    const dia = parts[2] ?? '';
    const date = new Date(`${payload?.value ?? '2000-01-01'}T12:00:00Z`);
    const letraDia = DIAS_SEMANA[date.getUTCDay()] ?? '';
    return (
        <g transform={`translate(${x ?? 0},${y ?? 0})`}>
            <text x={0} y={0} dy={10} textAnchor="middle" fontSize={10} fill="#6B6358">{dia}</text>
            <text x={0} y={0} dy={22} textAnchor="middle" fontSize={9} fill="#C79A34">{letraDia}</text>
        </g>
    );
}

const formatCompact = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        notation: 'compact',
        maximumFractionDigits: 1,
    }).format(value);

export function RelatoriosChart({ data, periodo }: { data: ChartDataPoint[]; periodo?: string }) {
    const isSemana = periodo === 'semana';
    const isMes = periodo === 'mes';

    return (
        <div className="bg-card rounded-xl p-4 border border-border">
            <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide mb-3">
                Entradas vs Saídas por Dia
            </p>
            <ChartContainer config={chartConfig} className={isSemana ? 'h-44 w-full aspect-auto' : 'h-40 w-full aspect-auto'}>
                <BarChart data={data} barCategoryGap="25%" margin={{ left: 0, right: 4, top: 4, bottom: isSemana ? 8 : 0 }}>
                    <XAxis
                        dataKey="date"
                        tickFormatter={isSemana ? undefined : (isMes ? undefined : formatDay)}
                        tick={isSemana ? SemanaTick : (isMes ? (props: any) => <MesTick {...props} data={data} /> : { fontSize: 10, fill: '#6B6358' })}
                        axisLine={false}
                        tickLine={false}
                        height={isSemana || isMes ? 36 : 20}
                        interval={0}
                    />
                    <YAxis
                        tickFormatter={formatCompact}
                        tick={{ fontSize: 9, fill: '#6B6358' }}
                        axisLine={false}
                        tickLine={false}
                        width={70}
                    />
                    <ChartTooltip
                        content={<ChartTooltipContent />}
                        cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                    />
                    <Bar dataKey="entradas" fill="#184434" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    <Bar dataKey="saidas" fill="#B54040" radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
            </ChartContainer>
        </div>
    );
}
