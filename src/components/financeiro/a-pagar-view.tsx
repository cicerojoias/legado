'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarDays, ChevronLeft, ChevronRight, Check, Clock, CreditCard, Info } from 'lucide-react';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/financeiro/moeda';
import { formatarDiaMes, nomeMes, nomeMesSo } from '@/lib/financeiro/formato-data';
import { rotuloCartao } from '@/lib/financeiro/compras-mensagens';
import { reaisParaCentavos } from '@/lib/financeiro/parcelas';
import { CompraDetalheModal } from './compra-detalhe-modal';
import { ConfirmarPagamentoModal } from './confirmar-pagamento-modal';
import type { CompraInfo, ParcelaPendente, ResumoCartao, StatusVencimento } from './a-pagar-tipos';

const BADGE: Record<StatusVencimento, { texto: string; classe: string; cartao: string }> = {
    ATRASADA: { texto: 'Atrasada', classe: 'bg-rose-500/10 text-rose-700', cartao: 'border border-rose-300' },
    HOJE: { texto: 'Vence hoje', classe: 'bg-[#C79A34]/15 text-[#8a6a1c]', cartao: 'border border-[#C79A34]/60' },
    AGENDADA: { texto: 'Agendada', classe: 'bg-muted text-muted-foreground', cartao: 'border border-transparent' },
};

interface Props {
    mes: string;
    mesAnterior: string;
    mesSeguinte: string;
    hoje: string;
    parcelas: ParcelaPendente[];
    compras: Record<string, CompraInfo>;
    resumoCartoes: ResumoCartao[];
    lojaFixa: 'JOAO_PESSOA' | 'SANTA_RITA' | null;
}

export function APagarView({ mes, mesAnterior, mesSeguinte, parcelas, compras, resumoCartoes, lojaFixa }: Props) {
    const [confirmando, setConfirmando] = useState<ParcelaPendente | null>(null);
    const [vendoCompraId, setVendoCompraId] = useState<string | null>(null);

    const atrasadas = parcelas.filter((p) => p.status === 'ATRASADA');
    const doMes = parcelas.filter((p) => p.vencimento.startsWith(mes));
    const doMesNormais = doMes.filter((p) => p.status !== 'ATRASADA');
    const totalMes = doMes.reduce((s, p) => s + (reaisParaCentavos(p.valor) ?? 0), 0);
    const totalAtrasadas = atrasadas.reduce((s, p) => s + (reaisParaCentavos(p.valor) ?? 0), 0);

    const renderCard = (p: ParcelaPendente, i: number) => {
        const c = compras[p.compraId];
        if (!c) return null;
        const b = BADGE[p.status];
        return (
            <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`bg-card shadow-sm rounded-2xl p-4 space-y-3 ${b.cartao}`}
            >
                <div className="flex items-center justify-between gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${b.classe}`}>
                        <Clock className="w-3 h-3" /> {b.texto}
                    </span>
                    <span className="text-xs text-muted-foreground">Vence em {formatarDiaMes(p.vencimento)}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="font-semibold text-[15px] truncate">{c.descricao}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Parcela {p.numero} de {c.qtd} · Compra de {formatBRL(Number(c.valorTotal))}
                        </p>
                    </div>
                    <p className="font-bold text-lg shrink-0">{formatBRL(Number(p.valor))}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CreditCard className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{rotuloCartao(c.cartao)}</span>
                    {!lojaFixa && <span className="shrink-0">· {c.loja === 'JOAO_PESSOA' ? 'J. Pessoa' : 'S. Rita'}</span>}
                </div>
                <div className="flex items-center justify-between gap-3 border-t pt-3">
                    <button type="button" className="text-sm font-semibold text-primary flex items-center gap-1" onClick={() => setVendoCompraId(c.id)}>
                        Ver compra <ChevronRight className="w-4 h-4" />
                    </button>
                    <Button type="button" className="rounded-xl font-bold" onClick={() => setConfirmando(p)}>
                        <Check className="w-4 h-4" /> Confirmar pagamento
                    </Button>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
            <p className="text-sm text-muted-foreground">O que está por vir no cartão. Para cadastrar uma compra, use <b>Registrar → Saída → Crédito parcelado</b>.</p>

            <div className="flex items-center justify-between">
                <Button asChild variant="ghost" size="icon" aria-label="Mês anterior">
                    <Link href={`/lancamentos?aba=a-pagar&mes=${mesAnterior}`} scroll={false}><ChevronLeft className="w-5 h-5" /></Link>
                </Button>
                <p className="font-bold text-lg">{nomeMes(mes)}</p>
                <Button asChild variant="ghost" size="icon" aria-label="Próximo mês">
                    <Link href={`/lancamentos?aba=a-pagar&mes=${mesSeguinte}`} scroll={false}><ChevronRight className="w-5 h-5" /></Link>
                </Button>
            </div>

            <Card className="p-5 bg-background/50 border-none shadow-none ring-1 ring-border flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Previsto para {nomeMesSo(mes)}</p>
                    <p className="text-3xl font-black text-primary">{formatBRL(totalMes / 100)}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                        {doMes.length} {doMes.length === 1 ? 'parcela aguardando pagamento' : 'parcelas aguardando pagamento'}
                    </p>
                </div>
                <div className="p-3 rounded-2xl bg-muted/60 text-muted-foreground"><CalendarDays className="w-6 h-6" /></div>
            </Card>
            <p className="flex items-center gap-2 text-xs text-muted-foreground"><Info className="w-4 h-4 shrink-0" /> Só entra nas saídas ao confirmar o pagamento.</p>

            {atrasadas.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-baseline justify-between">
                        <p className="text-[12px] font-bold uppercase text-rose-600 ml-1">Atrasadas</p>
                        <p className="text-xs font-semibold text-rose-600">{formatBRL(totalAtrasadas / 100)}</p>
                    </div>
                    {atrasadas.map(renderCard)}
                </section>
            )}

            <section className="space-y-3">
                <div className="flex items-baseline justify-between">
                    <p className="text-[12px] font-bold uppercase text-muted-foreground ml-1">Parcelas do mês</p>
                    <p className="text-xs text-muted-foreground">{doMesNormais.length} {doMesNormais.length === 1 ? 'pendente' : 'pendentes'}</p>
                </div>
                {doMesNormais.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <CalendarDays className="w-10 h-10 mb-3 opacity-20" />
                        <p className="text-sm">Nenhuma parcela a pagar neste mês.</p>
                    </div>
                ) : doMesNormais.map(renderCard)}
            </section>

            {resumoCartoes.length > 0 && (
                <section className="space-y-2 pt-2">
                    <p className="text-[12px] font-bold uppercase text-muted-foreground ml-1">Pendente por cartão</p>
                    <Card className="p-0 bg-background/50 border-none shadow-none ring-1 ring-border divide-y">
                        {resumoCartoes.map((r) => (
                            <div key={rotuloCartao(r)} className="flex items-center justify-between gap-3 px-4 py-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold truncate">{rotuloCartao(r)}</p>
                                    <p className="text-xs text-muted-foreground">{r.qtd} {r.qtd === 1 ? 'parcela' : 'parcelas'} em aberto</p>
                                </div>
                                <p className="font-bold shrink-0">{formatBRL(r.totalCentavos / 100)}</p>
                            </div>
                        ))}
                    </Card>
                    <p className="text-xs text-muted-foreground ml-1">Só para consulta. A devolução ao titular é registrada ao confirmar o pagamento de cada parcela.</p>
                </section>
            )}

            <ConfirmarPagamentoModal
                parcela={confirmando}
                compra={confirmando ? compras[confirmando.compraId] ?? null : null}
                onOpenChange={(o) => { if (!o) setConfirmando(null); }}
            />
            <CompraDetalheModal
                compra={vendoCompraId ? compras[vendoCompraId] ?? null : null}
                onOpenChange={(o) => { if (!o) setVendoCompraId(null); }}
            />
        </div>
    );
}
