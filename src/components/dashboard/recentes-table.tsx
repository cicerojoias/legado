import { TipoLancamento, Loja } from '@prisma/client';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMetodoPgtoLabel } from '@/lib/financeiro/metodos-pgto';

export interface LancamentoRecente {
    id: string;
    tipo: TipoLancamento;
    valor: number;
    descricao: string | null;
    loja: Loja;
    metodo_pgto: string | null;
    data_ref: Date;
    usuario: { nome: string } | null;
}

const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const formatDate = (date: Date) =>
    new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);

const LOJA_SHORT: Record<string, string> = {
    JOAO_PESSOA: 'JP',
    SANTA_RITA:  'SR',
    AMBAS:       'AM',
};

export function RecentesTable({ lancamentos }: { lancamentos: LancamentoRecente[] }) {
    return (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
                <p className="text-sm font-semibold">Lançamentos Recentes</p>
                <p className="text-xs text-muted-foreground">Todas as lojas</p>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left px-5 py-3 text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Data</th>
                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Descrição</th>
                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Loja</th>
                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Método</th>
                            <th className="text-left px-4 py-3 text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Usuário</th>
                            <th className="text-right px-5 py-3 text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Valor</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {lancamentos.map((l) => (
                            <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                                <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                    {formatDate(l.data_ref)}
                                </td>
                                <td className="px-4 py-3 max-w-[200px]">
                                    <div className="flex items-center gap-2">
                                        {l.tipo === 'ENTRADA'
                                            ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                            : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                        }
                                        <span className="truncate text-xs">{l.descricao ?? '—'}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium">
                                        {LOJA_SHORT[l.loja] ?? l.loja}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                    {getMetodoPgtoLabel(l.metodo_pgto)}
                                </td>
                                <td className="px-4 py-3 text-xs text-muted-foreground">
                                    {l.usuario?.nome ?? '—'}
                                </td>
                                <td className={cn(
                                    'px-5 py-3 text-xs font-bold text-right whitespace-nowrap',
                                    l.tipo === 'ENTRADA' ? 'text-emerald-600' : 'text-rose-600'
                                )}>
                                    {l.tipo === 'SAIDA' ? '−' : '+'}{formatBRL(l.valor)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {lancamentos.length === 0 && (
                    <div className="text-center py-10 text-muted-foreground text-sm">
                        Nenhum lançamento recente.
                    </div>
                )}
            </div>
        </div>
    );
}
