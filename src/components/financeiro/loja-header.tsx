'use client';

import { Loja } from '@prisma/client';
import { ChevronLeft, ChevronRight, Store } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

interface LojaHeaderProps {
    lojaSelecionada: Loja;
    lojaAutorizada: Loja;
}

export function LojaHeader({ lojaSelecionada, lojaAutorizada }: LojaHeaderProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Only allow switching if authorized for both
    const canSwitch = lojaAutorizada === 'AMBAS';

    const handleSwitch = () => {
        if (!canSwitch) return;
        const newLoja = lojaSelecionada === 'JOAO_PESSOA' ? 'SANTA_RITA' : 'JOAO_PESSOA';
        const params = new URLSearchParams(searchParams.toString());
        params.set('loja', newLoja);
        router.push(`/hoje?${params.toString()}`);
    };

    const formatLojaNome = (loja: Loja) => {
        if (loja === 'JOAO_PESSOA') return 'João Pessoa';
        if (loja === 'SANTA_RITA') return 'Santa Rita';
        return 'Todas as Lojas';
    };

    return (
        <div className="flex items-center justify-between py-2">
            {canSwitch ? (
                <button
                    onClick={handleSwitch}
                    className="p-2 -ml-2 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
            ) : <div className="p-2 w-9 h-9" />}

            <div className="flex items-center gap-2 font-semibold text-lg">
                <Store className="w-5 h-5 text-primary" />
                <span>{formatLojaNome(lojaSelecionada)}</span>
            </div>

            {canSwitch ? (
                <button
                    onClick={handleSwitch}
                    className="p-2 -mr-2 text-muted-foreground hover:text-foreground active:scale-95 transition-all"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            ) : <div className="p-2 w-9 h-9" />}
        </div>
    );
}
