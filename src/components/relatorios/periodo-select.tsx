'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const PERIODOS = [
    { value: 'hoje', label: 'Hoje' },
    { value: 'semana', label: 'Semana' },
    { value: 'mes', label: 'Mês' },
] as const;

export function PeriodoSelect({ current }: { current: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    function select(periodo: string) {
        const params = new URLSearchParams(searchParams.toString());
        params.set('periodo', periodo);
        router.push(`/relatorios?${params.toString()}`);
    }

    return (
        <div className="flex gap-0.5 bg-muted rounded-lg p-1 w-full">
            {PERIODOS.map((p) => (
                <button
                    key={p.value}
                    onClick={() => select(p.value)}
                    className={cn(
                        'flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors',
                        current === p.value
                            ? 'bg-card text-primary shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    )}
                >
                    {p.label}
                </button>
            ))}
        </div>
    );
}
