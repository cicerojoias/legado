'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Pencil, Trash2, ToggleLeft, ToggleRight, Plus, AlertCircle } from 'lucide-react';
import { CustoFixoForm } from './custo-fixo-form';
import { toggleCustoFixo, deletarCustoFixo } from '@/app/(protected)/custos-fixos/actions';
import { cn } from '@/lib/utils';

interface CustoFixoItem {
    id: string;
    nome: string;
    valor: number;
    loja: 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS';
    dia_venc: number;
    ativo: boolean;
}

const LOJA_LABELS: Record<string, string> = {
    JOAO_PESSOA: 'João Pessoa',
    SANTA_RITA:  'Santa Rita',
    AMBAS:       'Ambas',
};

const formatBRL = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

function CustoCard({
    custo,
    onEdit,
    onSuccess,
}: {
    custo: CustoFixoItem;
    onEdit: (c: CustoFixoItem) => void;
    onSuccess: (message: string) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [confirmDelete, setConfirmDelete] = useState(false);

    function handleToggle() {
        startTransition(async () => {
            const result = await toggleCustoFixo(custo.id);
            if (!result.success) toast.error(result.error);
        });
    }

    function handleDelete() {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        startTransition(async () => {
            const result = await deletarCustoFixo(custo.id);
            if (result.success) onSuccess('Custo fixo removido.');
            else toast.error(result.error);
            setConfirmDelete(false);
        });
    }

    return (
        <div
            className={cn(
                'bg-card rounded-xl border p-4 transition-opacity',
                !custo.ativo && 'opacity-50',
                isPending && 'pointer-events-none opacity-60'
            )}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className={cn('font-semibold text-sm truncate', !custo.ativo && 'line-through text-muted-foreground')}>
                        {custo.nome}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                            {LOJA_LABELS[custo.loja]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            Vence dia {custo.dia_venc}
                        </span>
                    </div>
                </div>

                <div className="text-right shrink-0">
                    <p className="text-base font-black text-rose-600">{formatBRL(custo.valor)}</p>
                    <p className="text-[10px] text-muted-foreground">/ mês</p>
                </div>
            </div>

            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                {/* Toggle ativo */}
                <button
                    onClick={handleToggle}
                    disabled={isPending}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    title={custo.ativo ? 'Desativar' : 'Ativar'}
                >
                    {custo.ativo
                        ? <ToggleRight className="w-4 h-4 text-[#184434]" />
                        : <ToggleLeft className="w-4 h-4" />
                    }
                    {custo.ativo ? 'Ativo' : 'Inativo'}
                </button>

                <div className="flex-1" />

                {/* Editar */}
                <button
                    onClick={() => onEdit(custo)}
                    disabled={isPending}
                    className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    title="Editar"
                >
                    <Pencil className="w-3.5 h-3.5" />
                </button>

                {/* Deletar */}
                <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className={cn(
                        'flex items-center gap-1 p-1.5 rounded-md transition-colors text-xs font-medium',
                        confirmDelete
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            : 'text-muted-foreground hover:text-rose-600 hover:bg-rose-50'
                    )}
                    title="Excluir"
                >
                    {confirmDelete ? (
                        <>
                            <AlertCircle className="w-3.5 h-3.5" />
                            Confirmar?
                        </>
                    ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                    )}
                </button>

                {confirmDelete && (
                    <button
                        onClick={() => setConfirmDelete(false)}
                        className="text-xs text-muted-foreground hover:text-foreground px-1"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}

interface CustoFixoListProps {
    custos: CustoFixoItem[];
    totalMensal: number;
}

export function CustoFixoList({ custos, totalMensal }: CustoFixoListProps) {
    const [editando, setEditando] = useState<CustoFixoItem | null>(null);
    const [criando, setCriando] = useState(false);
    const [feedback, setFeedback] = useState<string | null>(null);
    const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const ativos   = custos.filter((c) => c.ativo);
    const inativos = custos.filter((c) => !c.ativo);

    useEffect(() => {
        return () => {
            if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        };
    }, []);

    function handleSuccess(message: string) {
        setFeedback(message);
        if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
        feedbackTimerRef.current = setTimeout(() => {
            setFeedback(null);
        }, 2000);
    }

    return (
        <>
            <div className="flex-1 overflow-y-auto p-4 space-y-5 pb-24">
                {feedback && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
                        {feedback}
                    </div>
                )}

                {/* Resumo total */}
                <div className="bg-[#184434] rounded-xl p-4 text-white">
                    <p className="text-xs font-bold uppercase text-white/60 mb-1">Total mensal (ativos)</p>
                    <p className="text-2xl font-black text-[#C79A34]">{formatBRL(totalMensal)}</p>
                    <p className="text-xs text-white/50 mt-1">{ativos.length} custo{ativos.length !== 1 ? 's' : ''} fixo{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Botão novo */}
                <button
                    onClick={() => setCriando(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Novo custo fixo
                </button>

                {/* Lista ativos */}
                {ativos.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide ml-1">Ativos</p>
                        {ativos.map((c) => (
                            <CustoCard key={c.id} custo={c} onEdit={setEditando} onSuccess={handleSuccess} />
                        ))}
                    </div>
                )}

                {/* Lista inativos */}
                {inativos.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide ml-1">Inativos</p>
                        {inativos.map((c) => (
                            <CustoCard key={c.id} custo={c} onEdit={setEditando} onSuccess={handleSuccess} />
                        ))}
                    </div>
                )}

                {custos.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground text-sm">
                        <p className="mb-1 font-medium">Nenhum custo fixo cadastrado.</p>
                        <p className="text-xs">Clique em &quot;Novo custo fixo&quot; para começar.</p>
                    </div>
                )}
            </div>

            {/* Modais */}
            {criando && (
                <CustoFixoForm onClose={() => setCriando(false)} />
            )}
            {editando && (
                <CustoFixoForm custo={editando} onClose={() => setEditando(null)} />
            )}
        </>
    );
}
