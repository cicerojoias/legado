import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface MetricaCardProps {
    label: string;
    value: number;
    variacao: number | null; // % vs período anterior, null = não exibir
    tipo: 'entrada' | 'saida' | 'saldo';
}

export function MetricaCard({ label, value, variacao, tipo }: MetricaCardProps) {
    const isPositive = (variacao ?? 0) >= 0;

    return (
        <div
            className={cn(
                'rounded-xl p-3 border',
                tipo === 'saldo'
                    ? 'bg-[#184434] border-[#184434]'
                    : 'bg-card border-border'
            )}
        >
            <p
                className={cn(
                    'text-[10px] font-bold uppercase leading-none mb-2 tracking-wide',
                    tipo === 'saldo' ? 'text-white/60' : 'text-muted-foreground'
                )}
            >
                {label}
            </p>
            <p
                className={cn(
                    'text-sm font-black leading-tight',
                    tipo === 'entrada' && 'text-emerald-600',
                    tipo === 'saida' && 'text-rose-600',
                    tipo === 'saldo' && 'text-[#C79A34]'
                )}
            >
                {formatBRL(value)}
            </p>

            {variacao !== null && (
                <div
                    className={cn(
                        'flex items-center gap-0.5 mt-1.5',
                        isPositive ? 'text-emerald-500' : 'text-rose-500'
                    )}
                >
                    {isPositive ? (
                        <TrendingUp className="w-3 h-3" />
                    ) : (
                        <TrendingDown className="w-3 h-3" />
                    )}
                    <span className="text-[9px] font-bold">
                        {Math.abs(variacao).toFixed(1)}%
                    </span>
                </div>
            )}

            {variacao === null && tipo !== 'saldo' && (
                <p className="text-[9px] text-muted-foreground mt-1.5">sem comparativo</p>
            )}
        </div>
    );
}
