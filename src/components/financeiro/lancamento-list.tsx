'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TipoLancamento } from '@prisma/client';
import { ArrowDownRight, ArrowUpRight, HandCoins, Lock, Pen } from 'lucide-react';
import { EditarLancamentoModal, LancamentoParaEditar } from './editar-lancamento-modal';

const JANELA_24H_MS = 24 * 60 * 60 * 1000;

interface LancamentoItem {
    id: string;
    tipo: TipoLancamento;
    valor: number;
    descricao: string | null;
    metodo_pgto: string | null;
    created_at: Date;
    data_ref: Date;
    usuario: { nome: string } | null;
    usuario_id: string;
}

interface LancamentoListProps {
    lancamentos: LancamentoItem[];
    currentUserId: string;
    showDate?: boolean;
}

export function LancamentoList({ lancamentos, currentUserId, showDate = false }: LancamentoListProps) {
    const [selecionado, setSelecionado] = useState<LancamentoParaEditar | null>(null);
    const [modalOpen, setModalOpen] = useState(false);

    const formatTime = (date: Date) => {
        return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(date));
    };

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(date));
    };

    const formatBRL = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const handleCardClick = (item: LancamentoItem) => {
        setSelecionado({
            id: item.id,
            tipo: item.tipo,
            valor: item.valor,
            descricao: item.descricao,
            metodo_pgto: item.metodo_pgto,
            created_at: item.created_at,
            usuario_id: item.usuario_id,
        });
        setModalOpen(true);
    };

    const handleModalClose = (open: boolean) => {
        setModalOpen(open);
        if (!open) setSelecionado(null);
    };

    if (lancamentos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-muted-foreground">
                <HandCoins className="w-12 h-12 mb-4 opacity-20" />
                <p>Nenhum lançamento neste dia.</p>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-3">
                {lancamentos.map((item, index) => {
                    const isEntrada = item.tipo === 'ENTRADA';
                    const IconVariant = isEntrada ? ArrowUpRight : ArrowDownRight;
                    const colorClass = isEntrada ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500';
                    const bgClass = isEntrada ? 'bg-emerald-500/10' : 'bg-rose-500/10';

                    const isEditavel =
                        item.usuario_id === currentUserId &&
                        Date.now() - new Date(item.created_at).getTime() < JANELA_24H_MS;

                    return (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            onClick={() => handleCardClick(item)}
                            className="bg-card border-none shadow-sm rounded-2xl p-4 flex gap-4 items-center active:scale-[0.98] transition-all cursor-pointer"
                        >
                            <div className={`p-3 rounded-full ${bgClass} ${colorClass} shrink-0`}>
                                <IconVariant className="w-6 h-6" strokeWidth={2.5} />
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-[15px] truncate">
                                    {item.descricao || (isEntrada ? 'Entrada' : 'Saída')}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                    {showDate && (
                                        <>
                                            <span className="font-medium text-foreground/70">{formatDate(item.data_ref)}</span>
                                            <span>•</span>
                                        </>
                                    )}
                                    <span>{formatTime(item.created_at)}</span>
                                    <span>•</span>
                                    <span>{item.usuario?.nome?.split(' ')[0] || 'Desconhecido'}</span>
                                    {item.metodo_pgto && (
                                        <>
                                            <span>•</span>
                                            <span className="capitalize">{item.metodo_pgto.toLowerCase()}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                <p className={`font-bold ${colorClass}`}>
                                    {isEntrada ? '+' : '-'}{formatBRL(item.valor)}
                                </p>
                                {isEditavel ? (
                                    <Pen className="w-3 h-3 text-muted-foreground/50" />
                                ) : (
                                    <Lock className="w-3 h-3 text-muted-foreground/30" />
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <EditarLancamentoModal
                lancamento={selecionado}
                open={modalOpen}
                onOpenChange={handleModalClose}
                currentUserId={currentUserId}
            />
        </>
    );
}
