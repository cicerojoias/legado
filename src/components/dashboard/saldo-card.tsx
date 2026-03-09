import { ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

interface SaldoCardProps {
    label: string;
    entradas: number;
    saidas: number;
    destaque?: boolean;
}

export function SaldoCard({ label, entradas, saidas, destaque }: SaldoCardProps) {
    const saldo = entradas - saidas;

    return (
        <div
            className={cn(
                'rounded-xl border p-5',
                destaque
                    ? 'bg-[#184434] border-[#184434] text-white'
                    : 'bg-card border-border'
            )}
        >
            <p className={cn('text-xs font-bold uppercase tracking-wide mb-4', destaque ? 'text-white/60' : 'text-muted-foreground')}>
                {label}
            </p>

            <p className={cn('text-2xl font-black mb-4', destaque ? 'text-[#C79A34]' : saldo >= 0 ? 'text-[#184434]' : 'text-rose-600')}>
                {formatBRL(saldo)}
            </p>

            <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2">
                    <ArrowUpRight className={cn('w-4 h-4', destaque ? 'text-white/60' : 'text-emerald-500')} />
                    <div>
                        <p className={cn('text-[10px] font-medium', destaque ? 'text-white/50' : 'text-muted-foreground')}>Entradas</p>
                        <p className={cn('text-sm font-bold', destaque ? 'text-white' : 'text-emerald-600')}>
                            {formatBRL(entradas)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ArrowDownRight className={cn('w-4 h-4', destaque ? 'text-white/60' : 'text-rose-500')} />
                    <div>
                        <p className={cn('text-[10px] font-medium', destaque ? 'text-white/50' : 'text-muted-foreground')}>Saídas</p>
                        <p className={cn('text-sm font-bold', destaque ? 'text-white' : 'text-rose-600')}>
                            {formatBRL(saidas)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function SaldoCardSkeleton() {
    return <div className="rounded-xl border h-40 bg-muted animate-pulse" />;
}
