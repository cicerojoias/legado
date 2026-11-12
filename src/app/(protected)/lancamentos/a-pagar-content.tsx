import { prisma } from '@/lib/prisma';
import { Loja } from '@prisma/client';
import { dataUTCParaIso } from '@/lib/financeiro/parcelas';
import { deslocarMes } from '@/lib/financeiro/formato-data';
import { APagarView } from '@/components/financeiro/a-pagar-view';
import type {
    CompraInfo,
    ParcelaPendente,
    ResumoCartao,
    SituacaoParcela,
    StatusVencimento,
} from '@/components/financeiro/a-pagar-tipos';

const centavos = (v: { toString(): string }) => Math.round(Number(v.toString()) * 100);

// Só chamado para ADMIN/SUPER_ADMIN (a página decide). Lê previsões: nada daqui entra nos totais de Realizados.
export async function APagarContent({ mes, hoje, dbUserLoja }: { mes: string; hoje: string; dbUserLoja: Loja }) {
    const filtroLoja = dbUserLoja === 'AMBAS' ? {} : { loja: dbUserLoja };

    // Todas as parcelas pendentes (volume pequeno): mês, atrasadas e resumo por cartão saem de uma consulta só
    const pendentes = await prisma.parcelaCompra.findMany({
        where: { lancamento_id: null, cancelada_at: null, compra: { cancelado_at: null, ...filtroLoja } },
        include: { compra: true },
        orderBy: [{ vencimento: 'asc' }, { numero: 'asc' }],
    });

    const compraIds = [...new Set(pendentes.map((p) => p.compra_id))];
    const compras = await prisma.compraParcelada.findMany({
        where: { id: { in: compraIds } },
        include: { parcelas: { orderBy: { numero: 'asc' } } },
    });

    const status = (venc: string): StatusVencimento => (venc < hoje ? 'ATRASADA' : venc === hoje ? 'HOJE' : 'AGENDADA');

    const itens: ParcelaPendente[] = pendentes.map((p) => {
        const vencimento = dataUTCParaIso(p.vencimento);
        return {
            id: p.id,
            numero: p.numero,
            valor: p.valor.toString(),
            vencimento,
            status: status(vencimento),
            compraId: p.compra_id,
        };
    });

    const comprasInfo: Record<string, CompraInfo> = {};
    for (const c of compras) {
        comprasInfo[c.id] = {
            id: c.id,
            descricao: c.descricao,
            categoria: c.categoria,
            valorTotal: c.valor_total.toString(),
            qtd: c.qtd_parcelas,
            loja: c.loja as 'JOAO_PESSOA' | 'SANTA_RITA',
            cartao: { titular: c.cartao_titular, banco: c.cartao_banco, bandeira: c.cartao_bandeira },
            observacao: c.observacao,
            cancelada: !!c.cancelado_at,
            parcelas: c.parcelas.map((p) => ({
                id: p.id,
                numero: p.numero,
                valor: p.valor.toString(),
                vencimento: dataUTCParaIso(p.vencimento),
                situacao: (p.cancelada_at ? 'CANCELADA' : p.lancamento_id ? 'PAGA' : 'PENDENTE') as SituacaoParcela,
                pagaEm: p.paga_at ? dataUTCParaIso(p.paga_at) : null,
            })),
        };
    }

    // Resumo informativo por cartão/titular (decisão 5): quanto está pendente em cada um
    const porCartao = new Map<string, ResumoCartao>();
    for (const p of pendentes) {
        const k = `${p.compra.cartao_titular}|${p.compra.cartao_banco ?? ''}|${p.compra.cartao_bandeira ?? ''}`;
        const atual = porCartao.get(k) ?? {
            titular: p.compra.cartao_titular, banco: p.compra.cartao_banco, bandeira: p.compra.cartao_bandeira,
            totalCentavos: 0, qtd: 0,
        };
        atual.totalCentavos += centavos(p.valor);
        atual.qtd += 1;
        porCartao.set(k, atual);
    }

    return (
        <APagarView
            mes={mes}
            mesAnterior={deslocarMes(mes, -1)}
            mesSeguinte={deslocarMes(mes, 1)}
            hoje={hoje}
            parcelas={itens}
            compras={comprasInfo}
            resumoCartoes={[...porCartao.values()].sort((a, b) => b.totalCentavos - a.totalCentavos)}
            lojaFixa={dbUserLoja === 'AMBAS' ? null : (dbUserLoja as 'JOAO_PESSOA' | 'SANTA_RITA')}
        />
    );
}
