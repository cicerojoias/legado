'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Ban, CreditCard, Loader2, Pen } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CATEGORIA_LABELS } from '@/lib/financeiro/categorias';
import { formatBRL, formatCurrency, parseBRLtoNumber, reaisParaMascara } from '@/lib/financeiro/moeda';
import { formatarDataBR } from '@/lib/financeiro/formato-data';
import { reaisParaCentavos } from '@/lib/financeiro/parcelas';
import { mensagemCompraErro, rotuloCartao } from '@/lib/financeiro/compras-mensagens';
import { cancelarCompra, editarParcela } from '@/app/(protected)/lancamentos/compras-actions';
import type { CompraInfo, ParcelaDetalhe } from './a-pagar-tipos';

const SITUACAO_ESTILO: Record<ParcelaDetalhe['situacao'], { texto: string; classe: string }> = {
    PAGA: { texto: 'Paga', classe: 'bg-emerald-500/10 text-emerald-700' },
    PENDENTE: { texto: 'Pendente', classe: 'bg-muted text-muted-foreground' },
    CANCELADA: { texto: 'Cancelada', classe: 'bg-rose-500/10 text-rose-700' },
};

export function CompraDetalheModal({
    compra,
    onOpenChange,
}: {
    compra: CompraInfo | null;
    onOpenChange: (open: boolean) => void;
}) {
    const router = useRouter();
    const [editando, setEditando] = useState<string | null>(null);
    const [valor, setValor] = useState('');
    const [venc, setVenc] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);
    const [confirmarCancelar, setConfirmarCancelar] = useState(false);

    const iniciarEdicao = (p: ParcelaDetalhe) => {
        setEditando(p.id);
        setValor(reaisParaMascara(p.valor));
        setVenc(p.vencimento);
        setErro(null);
    };

    const salvarEdicao = async () => {
        if (!editando) return;
        setSalvando(true);
        setErro(null);
        try {
            const r = await editarParcela({ id: editando, valor: parseBRLtoNumber(valor), vencimento: venc });
            if (!r.success) { setErro(mensagemCompraErro(r)); return; }
            toast.success('Parcela atualizada.');
            setEditando(null);
            router.refresh();
        } catch {
            setErro('Erro de conexão. Tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    const cancelar = async () => {
        if (!compra) return;
        setSalvando(true);
        try {
            const r = await cancelarCompra({ id: compra.id });
            if (!r.success) { setErro(mensagemCompraErro(r)); setConfirmarCancelar(false); return; }
            toast.success('Compra cancelada. As parcelas pagas foram mantidas.');
            setConfirmarCancelar(false);
            onOpenChange(false);
            router.refresh();
        } catch {
            setErro('Erro de conexão. Tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    // Aviso (decisão 2): parcelas ativas podem ter sido ajustadas e não bater com o total informado
    const somaAtivas = compra
        ? compra.parcelas.filter((p) => p.situacao !== 'CANCELADA').reduce((s, p) => s + (reaisParaCentavos(p.valor) ?? 0), 0)
        : 0;
    const totalCentavos = compra ? (reaisParaCentavos(compra.valorTotal) ?? 0) : 0;
    const temPendente = !!compra?.parcelas.some((p) => p.situacao === 'PENDENTE');

    return (
        <>
            <Dialog open={!!compra} onOpenChange={onOpenChange}>
                <DialogContent className="max-h-[90vh] p-0 overflow-hidden gap-0" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
                    <div className="bg-primary px-6 py-5 relative">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            className="absolute top-4 right-4 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                            aria-label="Fechar"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <DialogHeader className="px-0 text-left">
                            <DialogTitle className="text-primary-foreground text-lg">{compra?.descricao ?? 'Compra'}</DialogTitle>
                            <DialogDescription className="text-primary-foreground/60 text-sm">
                                Compra de {compra ? formatBRL(Number(compra.valorTotal)) : ''} em {compra?.qtd}×
                                {compra?.categoria ? ` · ${CATEGORIA_LABELS[compra.categoria] ?? compra.categoria}` : ''}
                            </DialogDescription>
                        </DialogHeader>
                    </div>

                    {compra && (
                        <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-100px)] space-y-4">
                            {erro && (
                                <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                                    {erro}
                                </div>
                            )}

                            <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
                                <CreditCard className="w-5 h-5 text-muted-foreground shrink-0" />
                                <p className="text-sm font-semibold">{rotuloCartao(compra.cartao)}</p>
                            </div>
                            {compra.observacao && <p className="text-sm text-muted-foreground">Obs.: {compra.observacao}</p>}

                            {somaAtivas !== totalCentavos && (
                                <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    A soma das parcelas ({formatBRL(somaAtivas / 100)}) difere do total informado ({formatBRL(totalCentavos / 100)}).
                                    {' '}Isso é esperado se você ajustou valores ou cancelou parcelas.
                                </div>
                            )}

                            <ul className="space-y-2">
                                {compra.parcelas.map((p) => {
                                    const est = SITUACAO_ESTILO[p.situacao];
                                    const emEdicao = editando === p.id;
                                    return (
                                        <li key={p.id} className="rounded-2xl bg-card shadow-sm border px-4 py-3 space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-sm">Parcela {p.numero} de {compra.qtd}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Vence em {formatarDataBR(p.vencimento)}
                                                        {p.pagaEm ? ` · paga em ${formatarDataBR(p.pagaEm)}` : ''}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                                    <p className="font-bold">{formatBRL(Number(p.valor))}</p>
                                                    <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-0.5 ${est.classe}`}>{est.texto}</span>
                                                </div>
                                            </div>
                                            {p.situacao === 'PENDENTE' && !emEdicao && !compra.cancelada && (
                                                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={() => iniciarEdicao(p)}>
                                                    <Pen className="w-3.5 h-3.5" /> Editar valor ou data
                                                </Button>
                                            )}
                                            {emEdicao && (
                                                <div className="space-y-3">
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                                                            <Input inputMode="decimal" className="pl-9 font-semibold" value={valor} onChange={(e) => setValor(formatCurrency(e.target.value))} />
                                                        </div>
                                                        <Input type="date" value={venc} onChange={(e) => setVenc(e.target.value)} />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <Button type="button" variant="outline" onClick={() => setEditando(null)} disabled={salvando}>Cancelar</Button>
                                                        <Button type="button" onClick={salvarEdicao} disabled={salvando}>
                                                            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>

                            <p className="text-xs text-muted-foreground">
                                Parcelas pagas não podem ser alteradas aqui. Para corrigir uma, exclua o lançamento dela em Realizados dentro de 24 h e a parcela volta para A pagar.
                            </p>

                            {temPendente && !compra.cancelada && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full py-5 rounded-2xl font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
                                    onClick={() => setConfirmarCancelar(true)}
                                >
                                    <Ban className="w-4 h-4" /> Cancelar compra
                                </Button>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmarCancelar} onOpenChange={setConfirmarCancelar}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Cancelar esta compra?</AlertDialogTitle>
                        <AlertDialogDescription>
                            As parcelas pendentes serão encerradas e saem de A pagar. As parcelas já pagas continuam em Realizados.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={salvando}>Voltar</AlertDialogCancel>
                        <AlertDialogAction onClick={(e) => { e.preventDefault(); void cancelar(); }} disabled={salvando}>
                            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Cancelar compra'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
