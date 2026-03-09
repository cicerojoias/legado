import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { LancamentoList } from '@/components/financeiro/lancamento-list';
import { FechamentoDia } from '@/components/financeiro/fechamento-dia';
import { Loja } from '@prisma/client';

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
    type TotaisAcc = { entradas: number; saidas: number; pix: number; ton: number; especie: number };
    const totais = stats.reduce(
        (acc: TotaisAcc, curr) => {
            const valor = Number(curr._sum.valor) || 0;
            if (curr.tipo === 'ENTRADA') {
                acc.entradas += valor;
                if (curr.metodo_pgto === 'PIX') acc.pix += valor;
                else if (curr.metodo_pgto === 'TON') acc.ton += valor;
                else if (curr.metodo_pgto === 'ESPECIE') acc.especie += valor;
            } else {
                acc.saidas += valor;
            }
            return acc;
        },
        { entradas: 0, saidas: 0, pix: 0, ton: 0, especie: 0 }
    );

    const saldo = totais.entradas - totais.saidas;

    const serializedLancamentos = lancamentos.map((l: any) => ({
        ...l,
        valor: Number(l.valor),
    }));

    return (
        <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-48">
                <LancamentoList
                    lancamentos={serializedLancamentos}
                    currentUserId={userId}
                />
            </div>

            <div className="fixed bottom-16 md:bottom-4 left-0 md:left-64 right-0 p-4 md:px-8 z-20 pointer-events-none">
                <div className="pointer-events-auto max-w-5xl mx-auto">
                    <FechamentoDia totais={{ ...totais, saldo }} />
                </div>
            </div>
        </>
    );
}
