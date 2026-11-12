import Link from 'next/link';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { Loja } from '@prisma/client';
import { formatBRL } from '@/lib/financeiro/moeda';
import { hojeBrasilIso } from '@/lib/financeiro/formato-data';
import { isoParaDataUTC } from '@/lib/financeiro/parcelas';

// Aviso na tela Hoje: parcelas de compras no cartão que vencem hoje ou estão atrasadas.
// Só ADMIN/SUPER_ADMIN (a página decide); some quando não há nada. Não mexe nos totais do dia.
export async function AvisoVencimentos({ lojaAutorizada }: { lojaAutorizada: Loja }) {
    const hoje = isoParaDataUTC(hojeBrasilIso());
    const pendentes = await prisma.parcelaCompra.findMany({
        where: {
            lancamento_id: null,
            cancelada_at: null,
            vencimento: { lte: hoje },
            compra: { cancelado_at: null, ...(lojaAutorizada === 'AMBAS' ? {} : { loja: lojaAutorizada }) },
        },
        select: { valor: true, vencimento: true },
    });
    if (pendentes.length === 0) return null;

    const total = pendentes.reduce((s, p) => s + Math.round(Number(p.valor.toString()) * 100), 0);
    const atrasadas = pendentes.filter((p) => p.vencimento < hoje).length;
    const hojeQtd = pendentes.length - atrasadas;
    const partes = [
        hojeQtd > 0 ? `${hojeQtd} ${hojeQtd === 1 ? 'vence hoje' : 'vencem hoje'}` : null,
        atrasadas > 0 ? `${atrasadas} ${atrasadas === 1 ? 'atrasada' : 'atrasadas'}` : null,
    ].filter(Boolean).join(' · ');

    return (
        <div className="px-4 pt-3">
            <Link
                href="/lancamentos?aba=a-pagar"
                className={`flex items-center gap-3 rounded-2xl bg-card shadow-sm p-3 active:scale-[0.98] transition-all border ${atrasadas > 0 ? 'border-rose-300' : 'border-[#C79A34]/60'}`}
            >
                <div className={`p-2.5 rounded-full shrink-0 ${atrasadas > 0 ? 'bg-rose-500/10 text-rose-600' : 'bg-[#C79A34]/15 text-[#8a6a1c]'}`}>
                    <CalendarClock className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                        {pendentes.length} {pendentes.length === 1 ? 'parcela' : 'parcelas'} no cartão para pagar
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{partes} · {formatBRL(total / 100)}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            </Link>
        </div>
    );
}
