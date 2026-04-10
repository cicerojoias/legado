import { prisma } from '@/lib/prisma';
import { LancamentoList } from '@/components/financeiro/lancamento-list';
import { FechamentoDia } from '@/components/financeiro/fechamento-dia';
import { Loja, Prisma } from '@prisma/client';
import { normalizeMetodoPgto } from '@/lib/financeiro/metodos-pgto';

interface HojeContentProps {
    dateStr: string;
    targetLoja: string;
    userId: string;
}

export async function HojeContent({ dateStr, targetLoja, userId }: HojeContentProps) {
    const startOfDay = new Date(dateStr + 'T00:00:00.000Z');
    const endOfDay = new Date(dateStr + 'T23:59:59.999Z');

    const lancamentos = await prisma.lancamento.findMany({
        where: {
            loja: targetLoja as Loja,
            data_ref: {
                gte: startOfDay,
                lte: endOfDay,
            },
            deletado_at: null,
        },
        orderBy: { created_at: 'desc' },
        include: {
            usuario: { select: { nome: true } }
        }
    });

    // Busca as agregações (totais) diretamente no banco para performance
    const stats = await prisma.lancamento.groupBy({
        by: ['tipo', 'metodo_pgto'],
        where: {
            loja: targetLoja as Loja,
            data_ref: {
                gte: startOfDay,
                lte: endOfDay,
            },
            deletado_at: null,
        },
        _sum: {
            valor: true
        }
    });

    // Mapear os resultados da agregação para o formato esperado pelo componente
    type TotaisAcc = { entradas: number; saidas: number; pix: number; debito: number; credito: number; especie: number };
    const totais = stats.reduce(
        (acc: TotaisAcc, curr) => {
            const valor = Number(curr._sum.valor) || 0;
            const metodo = normalizeMetodoPgto(curr.metodo_pgto);
            if (curr.tipo === 'ENTRADA') {
                acc.entradas += valor;
                if (metodo === 'PIX') acc.pix += valor;
                else if (metodo === 'C_DEBITO') acc.debito += valor;
                else if (metodo === 'C_CREDITO') acc.credito += valor;
                else if (metodo === 'ESPECIE') acc.especie += valor;
            } else {
                acc.saidas += valor;
            }
            return acc;
        },
        { entradas: 0, saidas: 0, pix: 0, debito: 0, credito: 0, especie: 0 }
    );

    const saldo = totais.entradas - totais.saidas;

    type LancamentoComUsuario = Prisma.LancamentoGetPayload<{
        include: {
            usuario: {
                select: {
                    nome: true;
                };
            };
        };
    }>;

    const serializedLancamentos = lancamentos.map((l: LancamentoComUsuario) => ({
        ...l,
        valor: Number(l.valor),
    }));

    return (
        <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-[20rem] md:pb-48">
                <LancamentoList
                    lancamentos={serializedLancamentos}
                    currentUserId={userId}
                />
            </div>

            <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-3 right-3 md:bottom-4 md:left-64 md:right-0 p-0 md:px-8 z-20 pointer-events-none">
                <div className="pointer-events-auto max-w-5xl mx-auto">
                    <FechamentoDia totais={{ ...totais, saldo }} />
                </div>
            </div>
        </>
    );
}
