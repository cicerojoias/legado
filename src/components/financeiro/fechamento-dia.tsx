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
            className="bg-primary text-primary-foreground rounded-3xl p-5 shadow-2xl relative overflow-hidden"
            style={{ isolation: 'isolate' }}
        >
            <div className="absolute inset-0 bg-white/5" />

            <div className="flex justify-between items-end mb-4 relative z-10">
                <div>
                    <p className="text-primary-foreground/80 text-sm font-medium mb-1">Fechamento do Dia</p>
                    <h2 className="text-3xl font-bold tracking-tight">{formatBRL(totais.saldo)}</h2>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 relative z-10 pt-4 border-t border-white/10">
                <div>
                    <p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-semibold mb-1">PIX</p>
                    <p className="font-semibold">{formatBRL(totais.pix)}</p>
                </div>
                <div className="text-center">
                    <p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-semibold mb-1">Débito</p>
                    <p className="font-semibold">{formatBRL(totais.debito)}</p>
                </div>
                <div className="text-center md:text-left">
                    <p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-semibold mb-1">Crédito</p>
                    <p className="font-semibold">{formatBRL(totais.credito)}</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-primary-foreground/60 uppercase tracking-wider font-semibold mb-1">Espécie</p>
                    <p className="font-semibold">{formatBRL(totais.especie)}</p>
                </div>
            </div>
        </motion.div>
    );
}
