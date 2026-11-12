'use client';

// Campos extras do "Novo lançamento" quando a saída é Crédito parcelado (só ADMIN+):
// parcelas, primeiro vencimento, cartão e prévia. O valor, a descrição, a categoria e a loja
// continuam sendo os campos normais do lançamento.

import { CalendarClock, CreditCard } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatBRL } from '@/lib/financeiro/moeda';
import { formatarDataBR, hojeBrasilIso } from '@/lib/financeiro/formato-data';
import { MAX_PARCELAS, gerarParcelas } from '@/lib/financeiro/parcelas';
import { rotuloCartao } from '@/lib/financeiro/compras-mensagens';
import type { CartaoInfo } from './a-pagar-tipos';

const BANDEIRAS = ['Visa', 'Mastercard', 'Elo', 'American Express', 'Hipercard', 'Outra'];
const NOVO = '__novo__';

export type CompraCartaoEstado = {
    qtd: string;
    primeiro: string;
    cartaoSel: string; // '' = automático (primeiro cartão conhecido, ou novo se não houver)
    titular: string;
    banco: string;
    bandeira: string;
};

export const estadoInicialCompra = (): CompraCartaoEstado => ({
    qtd: '1', primeiro: hojeBrasilIso(), cartaoSel: '', titular: '', banco: '', bandeira: '',
});

function selecaoEfetiva(e: CompraCartaoEstado, cartoes: CartaoInfo[]) {
    return e.cartaoSel || (cartoes.length ? '0' : NOVO);
}

export function cartaoEscolhido(e: CompraCartaoEstado, cartoes: CartaoInfo[]): CartaoInfo {
    if (selecaoEfetiva(e, cartoes) === NOVO) {
        return { titular: e.titular.trim(), banco: e.banco.trim() || null, bandeira: e.bandeira || null };
    }
    return cartoes[Number(selecaoEfetiva(e, cartoes))] ?? { titular: '', banco: null, bandeira: null };
}

/** Mesmo cálculo do servidor, para a prévia. null se faltar dado ou o total for pequeno demais. */
export function previaParcelas(totalCentavos: number | null, e: CompraCartaoEstado) {
    const n = Number(e.qtd);
    if (!totalCentavos || !e.primeiro || totalCentavos < n) return null;
    try {
        return { total: totalCentavos, parcelas: gerarParcelas(totalCentavos, n, e.primeiro) };
    } catch {
        return null;
    }
}

export function CompraCartaoCampos({
    estado,
    onChange,
    cartoes,
    totalCentavos,
}: {
    estado: CompraCartaoEstado;
    onChange: (patch: Partial<CompraCartaoEstado>) => void;
    cartoes: CartaoInfo[] | null; // null = ainda carregando
    totalCentavos: number | null;
}) {
    const lista = cartoes ?? [];
    const sel = selecaoEfetiva(estado, lista);
    const novoCartao = sel === NOVO;
    const previa = previaParcelas(totalCentavos, estado);

    const texto = (() => {
        if (!previa) return null;
        const [p1, ...resto] = previa.parcelas;
        const n = previa.parcelas.length;
        if (resto.length === 0 || resto.every((p) => p.valorCentavos === p1.valorCentavos)) {
            return `${n}× de ${formatBRL(p1.valorCentavos / 100)}`;
        }
        return `1× de ${formatBRL(p1.valorCentavos / 100)} + ${n - 1}× de ${formatBRL(resto[0].valorCentavos / 100)}`;
    })();

    return (
        <div className="space-y-5 rounded-2xl border border-primary/15 bg-primary/[0.03] p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
                <CreditCard className="w-4 h-4" /> Compra no cartão de crédito
            </p>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select value={estado.qtd} onValueChange={(v) => onChange({ qtd: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {Array.from({ length: MAX_PARCELAS }, (_, i) => String(i + 1)).map((n) => (
                                <SelectItem key={n} value={n}>{n}×</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="cc-venc">Primeiro vencimento</Label>
                    <Input id="cc-venc" type="date" value={estado.primeiro} onChange={(e) => onChange({ primeiro: e.target.value })} />
                </div>
            </div>

            <div className="space-y-3">
                <Label>Cartão utilizado</Label>
                {cartoes === null && <p className="text-xs text-muted-foreground">Carregando cartões…</p>}
                {lista.length > 0 && (
                    <Select value={sel} onValueChange={(v) => onChange({ cartaoSel: v })}>
                        <SelectTrigger>
                            <div className="flex items-center gap-2 min-w-0">
                                <CreditCard className="w-4 h-4 text-muted-foreground shrink-0" />
                                <SelectValue />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {lista.map((c, i) => (
                                <SelectItem key={i} value={String(i)}>{rotuloCartao(c)}</SelectItem>
                            ))}
                            <SelectItem value={NOVO}>+ Cadastrar outro cartão</SelectItem>
                        </SelectContent>
                    </Select>
                )}
                {novoCartao && cartoes !== null && (
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="cc-titular">Titular <span className="text-rose-500">*</span></Label>
                            <Input id="cc-titular" value={estado.titular} maxLength={80} onChange={(e) => onChange({ titular: e.target.value })} placeholder="Nome de quem é o cartão" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cc-banco">Banco</Label>
                                <Input id="cc-banco" value={estado.banco} maxLength={40} onChange={(e) => onChange({ banco: e.target.value })} placeholder="Nubank, Itaú..." />
                            </div>
                            <div className="space-y-2">
                                <Label>Bandeira</Label>
                                <Select value={estado.bandeira} onValueChange={(v) => onChange({ bandeira: v })}>
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

            {previa && texto && (
                <div className="rounded-xl bg-background px-4 py-3 space-y-1 border">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <CalendarClock className="w-3 h-3" /> Como fica o parcelamento
                    </p>
                    <p className="text-xl font-black text-primary">{texto}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Primeira: {formatarDataBR(previa.parcelas[0].vencimento)}</span>
                        <span>Última: {formatarDataBR(previa.parcelas[previa.parcelas.length - 1].vencimento)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Total da compra: <b className="text-foreground">{formatBRL(previa.total / 100)}</b></p>
                </div>
            )}
            <p className="text-xs text-muted-foreground">As parcelas só entram nas saídas quando você confirmar cada pagamento em Lançamentos → A pagar.</p>
        </div>
    );
}
