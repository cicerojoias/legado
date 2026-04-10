'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

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

const STORAGE_KEY = 'fechamento-expanded';

export function FechamentoDia({ totais }: FechamentoProps) {
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved !== null) setExpanded(saved === 'true');
    }, []);

    function toggle() {
        setExpanded((prev) => {
            localStorage.setItem(STORAGE_KEY, String(!prev));
            return !prev;
        });
    }

    const formatBRL = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-[28px] bg-primary text-primary-foreground shadow-2xl"
            style={{ isolation: 'isolate' }}
        >
            <div className="absolute inset-0 bg-white/5" />
            <div className="absolute inset-x-0 top-0 h-px bg-white/15" />

            {/* Header — sempre visível, clicável */}
            <button
                onClick={toggle}
                className="relative z-10 flex w-full items-center justify-between gap-3 px-4 py-3 md:px-5 md:py-4"
            >
                <div className="min-w-0 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary-foreground/65">
                        Fechamento do dia
                    </p>
                    <h2 className="mt-0.5 text-3xl font-black tracking-tight md:text-4xl">
                        {formatBRL(totais.saldo)}
                    </h2>
                </div>

                <motion.div
                    animate={{ rotate: expanded ? 0 : 180 }}
                    transition={{ duration: 0.25 }}
                    className="shrink-0 rounded-full border border-white/15 bg-white/10 p-1.5"
                >
                    <ChevronDown className="h-4 w-4 text-primary-foreground/70" />
                </motion.div>
            </button>

            {/* Detalhes — expandível */}
            <AnimatePresence initial={false}>
                {expanded && (
                    <motion.div
                        key="details"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="relative z-10 space-y-2 px-4 pb-4 md:space-y-3 md:px-5 md:pb-5">
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
                                {[
                                    { label: 'PIX', value: totais.pix },
                                    { label: 'Débito', value: totais.debito },
                                    { label: 'Crédito', value: totais.credito },
                                    { label: 'Espécie', value: totais.especie },
                                ].map(({ label, value }) => (
                                    <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.08] px-2 py-2 md:px-3 md:py-3">
                                        <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-primary-foreground/60 md:text-[10px] md:tracking-[0.22em]">
                                            {label}
                                        </p>
                                        <p className="mt-0.5 text-xs font-bold md:mt-1 md:text-base">{formatBRL(value)}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
