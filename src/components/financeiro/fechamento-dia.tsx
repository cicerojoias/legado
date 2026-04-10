'use client';

import { motion } from 'framer-motion';

interface FechamentoProps {
    totais: {
        entradas: number;
        saidas: number;
        pix: number;
        debito: number;
        credito: number;
        especie: number;
        saldo: number;
    }
}

export function FechamentoDia({ totais }: FechamentoProps) {
    const formatBRL = (value: number) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        }).format(value);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[28px] bg-primary p-4 text-primary-foreground shadow-2xl md:p-5"
            style={{ isolation: 'isolate' }}
        >
            <div className="absolute inset-0 bg-white/5" />
            <div className="absolute inset-x-0 top-0 h-px bg-white/15" />

            <div className="relative z-10 space-y-2 md:space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-foreground/65">
                            Fechamento do dia
                        </p>
                        <h2 className="mt-1 text-3xl font-black tracking-tight md:mt-2 md:text-4xl">
                            {formatBRL(totais.saldo)}
                        </h2>
                    </div>

                    <div className="shrink-0 rounded-2xl border border-white/10 bg-white/10 px-3 py-1.5 text-right md:py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/60">
                            Saldo líquido
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-primary-foreground/80">
                            Entradas - saídas
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 md:py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/60">
                            Entradas
                        </p>
                        <p className="mt-0.5 text-lg font-bold md:mt-1 md:text-xl">{formatBRL(totais.entradas)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-3 py-2 text-right md:py-3 md:text-left">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary-foreground/60">
                            Saídas
                        </p>
                        <p className="mt-0.5 text-lg font-bold md:mt-1 md:text-xl">{formatBRL(totais.saidas)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-4 gap-1.5 md:gap-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-2 py-2 md:px-3 md:py-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60 md:text-[10px] md:tracking-[0.22em]">PIX</p>
                        <p className="mt-0.5 text-xs font-bold md:mt-1 md:text-base">{formatBRL(totais.pix)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-2 py-2 md:px-3 md:py-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60 md:text-[10px] md:tracking-[0.22em]">Débito</p>
                        <p className="mt-0.5 text-xs font-bold md:mt-1 md:text-base">{formatBRL(totais.debito)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-2 py-2 md:px-3 md:py-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60 md:text-[10px] md:tracking-[0.22em]">Crédito</p>
                        <p className="mt-0.5 text-xs font-bold md:mt-1 md:text-base">{formatBRL(totais.credito)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.08] px-2 py-2 md:px-3 md:py-3">
                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60 md:text-[10px] md:tracking-[0.22em]">Espécie</p>
                        <p className="mt-0.5 text-xs font-bold md:mt-1 md:text-base">{formatBRL(totais.especie)}</p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
