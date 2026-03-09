'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const LOJAS = ['TODAS', 'JOAO_PESSOA', 'SANTA_RITA'] as const;
type LojaOption = typeof LOJAS[number];

const LOJA_LABELS: Record<LojaOption, string> = {
    TODAS: 'Todas as Lojas',
    JOAO_PESSOA: 'João Pessoa',
    SANTA_RITA: 'Santa Rita',
};

export function LojaFilter({ current }: { current: string }) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const currentIndex = LOJAS.indexOf(current as LojaOption);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;

    function navigate(direction: 'prev' | 'next') {
        const newIndex =
            direction === 'next'
                ? (safeIndex + 1) % LOJAS.length
                : (safeIndex - 1 + LOJAS.length) % LOJAS.length;

        const params = new URLSearchParams(searchParams.toString());
        params.set('loja', LOJAS[newIndex]);
        router.push(`/relatorios?${params.toString()}`);
    }

    return (
        <div className="flex items-center gap-1.5 shrink-0">
            <button
                onClick={() => navigate('prev')}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                aria-label="Loja anterior"
            >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-semibold min-w-[120px] text-center tabular-nums">
                {LOJA_LABELS[current as LojaOption] ?? 'Todas as Lojas'}
            </span>
            <button
                onClick={() => navigate('next')}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                aria-label="Próxima loja"
            >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
        </div>
    );
}
