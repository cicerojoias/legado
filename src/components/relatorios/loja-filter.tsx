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

export function LojaFilter({ current }: { current?: string }) {
    return (
        <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm font-semibold min-w-[120px] text-center">
                Santa Rita
            </span>
        </div>
    );
}
