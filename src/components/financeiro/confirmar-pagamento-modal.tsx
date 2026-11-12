'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, CreditCard, Loader2 } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { METODOS_SAIDA, METODO_LABELS } from '@/lib/financeiro/metodos-pgto';
import { formatBRL } from '@/lib/financeiro/moeda';
import { hojeBrasilIso } from '@/lib/financeiro/formato-data';
import { mensagemCompraErro, rotuloCartao } from '@/lib/financeiro/compras-mensagens';
import { confirmarPagamento } from '@/app/(protected)/lancamentos/compras-actions';
import type { CompraInfo, ParcelaPendente } from './a-pagar-tipos';

export function ConfirmarPagamentoModal({
    parcela,
    compra,
    onOpenChange,
}: {
    parcela: ParcelaPendente | null;
    compra: CompraInfo | null;
    onOpenChange: (open: boolean) => void;
}) {
    const open = !!parcela && !!compra;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] p-0 overflow-hidden gap-0" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
                {parcela && compra && <CorpoConfirmar key={parcela.id} parcela={parcela} compra={compra} onOpenChange={onOpenChange} />}
            </DialogContent>
        </Dialog>
    );
}

// Estado nasce a cada abertura (key = parcela): sem efeito para reiniciar, e a data de hoje só existe no navegador
function CorpoConfirmar({
    parcela,
    compra,
    onOpenChange,
}: {
    parcela: ParcelaPendente;
    compra: CompraInfo;
    onOpenChange: (open: boolean) => void;
}) {
    const router = useRouter();
    const [data, setData] = useState(() => hojeBrasilIso());
    const [metodo, setMetodo] = useState<string>('PIX');
    const [obs, setObs] = useState('');
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const confirmar = async () => {
        setSalvando(true);
        setErro(null);
        try {
            const r = await confirmarPagamento({
                parcela_id: parcela.id,
                data_pagamento: data,
                metodo_pgto: metodo,
                observacao: obs || null,
            });
            if (!r.success) {
                setErro(mensagemCompraErro(r));
                return;
            }
            toast.success('Pagamento confirmado. A saída já está em Realizados.');
            onOpenChange(false);
            router.refresh();
        } catch {
            setErro('Erro de conexão. Tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <>
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
                        <DialogTitle className="text-primary-foreground text-lg">Confirmar pagamento</DialogTitle>
                        <DialogDescription className="text-primary-foreground/60 text-sm">
                            {compra.descricao} · Parcela {parcela.numero} de {compra.qtd}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {(
                    <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-100px)] space-y-5">
                        {erro && (
                            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                                {erro}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Valor pago</Label>
                                <Input value={formatBRL(Number(parcela.valor))} readOnly disabled className="text-lg font-semibold h-12" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="data-pgto">Data do pagamento</Label>
                                <Input
                                    id="data-pgto"
                                    type="date"
                                    value={data}
                                    max={hojeBrasilIso()}
                                    onChange={(e) => setData(e.target.value)}
                                    className="h-12"
                                />
                            </div>
                        </div>
                        <p className="-mt-3 text-xs text-muted-foreground">
                            O valor é o da parcela. Se pagou diferente (juros, desconto), feche, abra “Ver compra” e edite a parcela antes.
                        </p>

                        <div className="space-y-2">
                            <Label>Como o dinheiro saiu?</Label>
                            <Select value={metodo} onValueChange={setMetodo}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {METODOS_SAIDA.map((m) => (
                                        <SelectItem key={m} value={m}>{METODO_LABELS[m] ?? m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">Informe a forma usada para pagar ou reembolsar.</p>
                        </div>

                        <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-4 py-3">
                            <CreditCard className="w-5 h-5 text-muted-foreground shrink-0" />
                            <p className="text-sm font-semibold">{rotuloCartao(compra.cartao)}</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="obs-pgto">Observação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                            <Input id="obs-pgto" value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: reembolso da parcela para o titular" />
                        </div>

                        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary/90">
                            Ao confirmar, este valor entra nas saídas na data do pagamento. A parcela fica marcada como paga.
                        </div>

                        <div className="grid grid-cols-[1fr_2fr] gap-3">
                            <Button type="button" variant="outline" className="py-6 rounded-2xl font-semibold" onClick={() => onOpenChange(false)} disabled={salvando}>
                                Voltar
                            </Button>
                            <Button
                                type="button"
                                className="py-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 transition-all"
                                onClick={confirmar}
                                disabled={salvando || !data}
                            >
                                {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Check className="w-5 h-5" /> Confirmar pagamento</>}
                            </Button>
                        </div>
                    </div>
                )}
        </>
    );
}
