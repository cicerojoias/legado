'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CalendarClock, CreditCard, Loader2, Plus } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CATEGORIA_LABELS, CATEGORIAS_SAIDA } from '@/lib/financeiro/categorias';
import { formatBRL, formatCurrency, parseBRLtoNumber } from '@/lib/financeiro/moeda';
import { formatarDataBR, hojeBrasilIso } from '@/lib/financeiro/formato-data';
import { MAX_PARCELAS, gerarParcelas, reaisParaCentavos } from '@/lib/financeiro/parcelas';
import { mensagemCompraErro, rotuloCartao } from '@/lib/financeiro/compras-mensagens';
import { criarCompra } from '@/app/(protected)/lancamentos/compras-actions';
import type { CartaoInfo } from './a-pagar-tipos';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra'];
const NOVO = '__novo__';

export function CompraCartaoModal({
    cartoesConhecidos,
    lojaFixa,
}: {
    cartoesConhecidos: CartaoInfo[];
    lojaFixa: 'JOAO_PESSOA' | 'SANTA_RITA' | null;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [salvando, setSalvando] = useState(false);
    const [erro, setErro] = useState<string | null>(null);

    const [descricao, setDescricao] = useState('');
    const [valor, setValor] = useState('0,00');
    const [qtd, setQtd] = useState('1');
    const [primeiro, setPrimeiro] = useState('');
    const [categoria, setCategoria] = useState('FORNECEDOR');
    const [loja, setLoja] = useState<string>(lojaFixa ?? 'JOAO_PESSOA');
    const [cartaoSel, setCartaoSel] = useState<string>(cartoesConhecidos.length ? '0' : NOVO);
    const [titular, setTitular] = useState('');
    const [banco, setBanco] = useState('');
    const [bandeira, setBandeira] = useState('');
    const [obs, setObs] = useState('');

    const reiniciar = () => {
        setDescricao(''); setValor('0,00'); setQtd('1'); setPrimeiro(hojeBrasilIso());
        setCategoria('FORNECEDOR'); setLoja(lojaFixa ?? 'JOAO_PESSOA');
        setCartaoSel(cartoesConhecidos.length ? '0' : NOVO);
        setTitular(''); setBanco(''); setBandeira(''); setObs(''); setErro(null);
    };

    const novoCartao = cartaoSel === NOVO;
    const cartao: CartaoInfo = novoCartao
        ? { titular: titular.trim(), banco: banco.trim() || null, bandeira: bandeira || null }
        : cartoesConhecidos[Number(cartaoSel)] ?? { titular: '', banco: null, bandeira: null };

    // Prévia usando exatamente o mesmo cálculo do servidor
    const previa = useMemo(() => {
        const total = reaisParaCentavos(parseBRLtoNumber(valor));
        const n = Number(qtd);
        if (!total || !primeiro || total < n) return null;
        try {
            return { total, parcelas: gerarParcelas(total, n, primeiro) };
        } catch {
            return null;
        }
    }, [valor, qtd, primeiro]);

    const textoParcelas = (() => {
        if (!previa) return null;
        const [p1, ...resto] = previa.parcelas;
        const n = previa.parcelas.length;
        if (resto.length === 0 || resto.every((p) => p.valorCentavos === p1.valorCentavos)) {
            return `${n}× de ${formatBRL(p1.valorCentavos / 100)}`;
        }
        return `1× de ${formatBRL(p1.valorCentavos / 100)} + ${n - 1}× de ${formatBRL(resto[0].valorCentavos / 100)}`;
    })();

    const salvar = async () => {
        setSalvando(true);
        setErro(null);
        try {
            const r = await criarCompra({
                descricao,
                categoria,
                loja: lojaFixa ?? loja,
                valor_total: parseBRLtoNumber(valor),
                qtd_parcelas: Number(qtd),
                primeiro_vencimento: primeiro,
                cartao_titular: cartao.titular,
                cartao_banco: cartao.banco,
                cartao_bandeira: cartao.bandeira,
                observacao: obs || null,
            });
            if (!r.success) {
                setErro(mensagemCompraErro(r));
                return;
            }
            toast.success(`Compra registrada: ${qtd} ${Number(qtd) === 1 ? 'parcela agendada' : 'parcelas agendadas'}.`);
            setOpen(false);
            router.refresh();
        } catch {
            setErro('Erro de conexão. Tente novamente.');
        } finally {
            setSalvando(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) reiniciar(); }}>
            <DialogTrigger asChild>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl" aria-label="Nova compra no cartão">
                    <Plus className="w-5 h-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] p-0 overflow-hidden gap-0" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
                <div className="bg-primary px-6 py-5 relative">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
                        className="absolute top-4 right-4 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                        aria-label="Fechar"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                    <DialogHeader className="px-0 text-left">
                        <DialogTitle className="text-primary-foreground text-lg">Compra no cartão</DialogTitle>
                        <DialogDescription className="text-primary-foreground/60 text-sm">
                            Cadastre uma vez. Veja mês a mês.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-100px)] space-y-5">
                    {erro && (
                        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                            {erro}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="cc-desc">O que foi comprado? <span className="text-rose-500">*</span></Label>
                        <Input id="cc-desc" value={descricao} maxLength={120} onChange={(e) => setDescricao(e.target.value)} placeholder="Material para oficina..." />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cc-valor">Valor total da compra <span className="text-rose-500">*</span></Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">R$</span>
                                <Input
                                    id="cc-valor"
                                    inputMode="decimal"
                                    className="pl-10 text-lg font-semibold h-12"
                                    value={valor}
                                    onChange={(e) => setValor(formatCurrency(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Parcelas</Label>
                            <Select value={qtd} onValueChange={setQtd}>
                                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {Array.from({ length: MAX_PARCELAS }, (_, i) => String(i + 1)).map((n) => (
                                        <SelectItem key={n} value={n}>{n}×</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="cc-venc">Primeiro vencimento</Label>
                            <Input id="cc-venc" type="date" value={primeiro} onChange={(e) => setPrimeiro(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Categoria</Label>
                            <Select value={categoria} onValueChange={setCategoria}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS_SAIDA.map((c) => (
                                        <SelectItem key={c} value={c}>{CATEGORIA_LABELS[c] ?? c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {!lojaFixa && (
                        <div className="space-y-2">
                            <Label>Loja <span className="text-rose-500">*</span></Label>
                            <Select value={loja} onValueChange={setLoja}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="JOAO_PESSOA">João Pessoa</SelectItem>
                                    <SelectItem value="SANTA_RITA">Santa Rita</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="border-t pt-5 space-y-3">
                        <p className="text-base font-semibold">Cartão utilizado</p>
                        {cartoesConhecidos.length > 0 && (
                            <Select value={cartaoSel} onValueChange={setCartaoSel}>
                                <SelectTrigger className="h-12">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                                        <SelectValue />
                                    </div>
                                </SelectTrigger>
                                <SelectContent>
                                    {cartoesConhecidos.map((c, i) => (
                                        <SelectItem key={i} value={String(i)}>{rotuloCartao(c)}</SelectItem>
                                    ))}
                                    <SelectItem value={NOVO}>+ Cadastrar outro cartão</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                        {novoCartao && (
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label htmlFor="cc-titular">Titular <span className="text-rose-500">*</span></Label>
                                    <Input id="cc-titular" value={titular} maxLength={80} onChange={(e) => setTitular(e.target.value)} placeholder="Nome de quem é o cartão" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="cc-banco">Banco</Label>
                                        <Input id="cc-banco" value={banco} maxLength={40} onChange={(e) => setBanco(e.target.value)} placeholder="Nubank, Itaú..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Bandeira</Label>
                                        <Select value={bandeira} onValueChange={setBandeira}>
                                            <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                                            <SelectContent>
                                                {BANDEIRAS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">Pode ser seu, de Cícero ou de outra pessoa. Não guardamos número, validade nem código.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cc-obs">Observação <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                        <Input id="cc-obs" value={obs} maxLength={300} onChange={(e) => setObs(e.target.value)} />
                    </div>

                    {previa && textoParcelas && (
                        <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 space-y-1">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Como fica o parcelamento</p>
                            <p className="text-2xl font-black text-primary">{textoParcelas}</p>
                            <div className="flex justify-between text-sm text-muted-foreground">
                                <span>Primeira: {formatarDataBR(previa.parcelas[0].vencimento)}</span>
                                <span>Última: {formatarDataBR(previa.parcelas[previa.parcelas.length - 1].vencimento)}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">Total da compra: <b className="text-foreground">{formatBRL(previa.total / 100)}</b></p>
                        </div>
                    )}

                    <Button
                        type="button"
                        className="w-full py-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 transition-all"
                        onClick={salvar}
                        disabled={salvando || !previa || !descricao.trim() || cartao.titular.length < 2}
                    >
                        {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                            <><CalendarClock className="w-5 h-5" /> Agendar {qtd} {Number(qtd) === 1 ? 'parcela' : 'parcelas'}</>
                        )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">As parcelas só entram nas saídas quando você confirmar cada pagamento.</p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
