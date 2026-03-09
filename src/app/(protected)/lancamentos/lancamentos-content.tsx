import { prisma } from '@/lib/prisma';
import { LancamentoList } from '@/components/financeiro/lancamento-list';
import { Loja, TipoLancamento } from '@prisma/client';
import { Card } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, Wallet } from 'lucide-react';

interface LancamentosContentProps {
    from: string;
    to: string;
    loja?: string;
    tipo?: string;
    dbUserLoja: Loja;
    userId: string;
}

export async function LancamentosContent({ from, to, loja, tipo, dbUserLoja, userId }: LancamentosContentProps) {
    const startDate = new Date(from + 'T00:00:00.000Z');
    const endDate = new Date(to + 'T23:59:59.999Z');

    // Build filter — deletado_at: null garante que soft-deletes nunca aparecem
    const where: any = {
        data_ref: {
            gte: startDate,
            lte: endDate,
        },
        deletado_at: null,
    };

    // Store security: only allow 'AMBAS' if user has permission
    if (dbUserLoja === 'AMBAS') {
        if (loja && (loja === 'JOAO_PESSOA' || loja === 'SANTA_RITA')) {
            where.loja = loja as Loja;
        }
    } else {
        where.loja = dbUserLoja;
    }

    if (tipo && tipo !== 'TODOS') {
        where.tipo = tipo as TipoLancamento;
    }

    // Fetch data and stats in parallel
    const [lancamentos, stats] = await Promise.all([
        prisma.lancamento.findMany({
            where,
            orderBy: { data_ref: 'desc' },
            include: {
                usuario: { select: { nome: true } }
            },
            take: 100, // Limit for now, pagination to be added
        }),
        prisma.lancamento.groupBy({
            by: ['tipo'],
            where,
            _sum: {
                valor: true
            }
        })
    ]);

    // Calculate totals
    type TotalsAcc = { entradas: number; saidas: number };
    const totals = stats.reduce(
        (acc: TotalsAcc, curr) => {
            const val = Number(curr._sum.valor) || 0;
            if (curr.tipo === 'ENTRADA') acc.entradas = val;
            if (curr.tipo === 'SAIDA') acc.saidas = val;
            return acc;
        },
        { entradas: 0, saidas: 0 }
    );

    const saldo = totals.entradas - totals.saidas;

    const serializedLancamentos = lancamentos.map((l: any) => ({
        ...l,
        valor: Number(l.valor),
    }));

    const formatBRL = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20">
            {/* Resumo do Período */}
            <div className="grid grid-cols-2 gap-3">
                <Card className="p-4 bg-background/50 border-none shadow-none ring-1 ring-border flex items-center gap-3">
                    <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-600">
                        <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground leading-none mb-1">Entradas</p>
                        <p className="text-sm font-bold text-emerald-600">{formatBRL(totals.entradas)}</p>
                    </div>
                </Card>
                <Card className="p-4 bg-background/50 border-none shadow-none ring-1 ring-border flex items-center gap-3">
                    <div className="p-2 rounded-full bg-rose-500/10 text-rose-600">
                        <ArrowDownRight className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase text-muted-foreground leading-none mb-1">Saídas</p>
                        <p className="text-sm font-bold text-rose-600">{formatBRL(totals.saidas)}</p>
                    </div>
                </Card>
            </div>

            <Card className="p-4 bg-primary text-primary-foreground border-none shadow-lg shadow-primary/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-white/20">
                        <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold uppercase opacity-80 leading-none mb-1">Saldo do Período</p>
                        <p className="text-xl font-black">{formatBRL(saldo)}</p>
                    </div>
                </div>
            </Card>

            <div className="pt-2">
                <p className="text-[12px] font-bold uppercase text-muted-foreground mb-3 ml-1">Lançamentos Recentes</p>
                <LancamentoList
                    lancamentos={serializedLancamentos}
                    currentUserId={userId}
                    showDate={true}
                />
            </div>

            {lancamentos.length === 100 && (
                <p className="text-center text-xs text-muted-foreground py-4 italic">
                    Exibindo os últimos 100 lançamentos. Para mais registros, refine os filtros de data.
                </p>
            )}
        </div>
    );
}
