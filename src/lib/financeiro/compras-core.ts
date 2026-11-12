// Núcleo transacional das compras no cartão / parceladas (docs/PLANO-COMPRAS-PARCELADAS.md).
// Sem Supabase nem Next: recebe o cliente do banco e o usuário já autorizado (ADMIN+),
// para poder ser testado contra um Postgres local. Quem autentica é compras-actions.ts.

import { Loja, Prisma, type PrismaClient } from '@prisma/client';
import {
    CancelarCompraSchema,
    ConfirmarPagamentoSchema,
    CriarCompraSchema,
    EditarParcelaSchema,
} from '@/lib/validations';
import {
    centavosParaReais,
    dataUTCParaIso,
    gerarParcelas,
    isoParaDataUTC,
    reaisParaCentavos,
} from '@/lib/financeiro/parcelas';

export type CompraErrorCode =
    | 'NAO_AUTORIZADO'       // Sem papel, registro inexistente ou de outra loja
    | 'CAMPOS_INVALIDOS'
    | 'CONFLITO_CONCORRENTE' // P2034
    | 'USUARIO_INATIVO'
    | 'RATE_LIMIT'
    | 'PARCELA_JA_PAGA'      // Já confirmada (inclui confirmação duplicada)
    | 'PARCELA_CANCELADA'
    | 'COMPRA_CANCELADA'
    | 'DATA_FUTURA'          // Pagamento não pode ter data futura
    | 'SEM_PENDENTES'        // Nada a cancelar
    | 'ERRO_INTERNO';

export type CompraResult =
    | { success: true; id?: string }
    | { success: false; code: CompraErrorCode; message?: string };

export type Autorizado = { userId: string; lojaAutorizada: Loja };

class CompraError extends Error {
    constructor(public readonly code: CompraErrorCode) {
        super(code);
        this.name = 'CompraError';
    }
}

const TX_OPTIONS = {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,
    timeout: 10000,
} as const;

function lojaPermitida(auth: Autorizado, loja: Loja) {
    return auth.lojaAutorizada === 'AMBAS' || auth.lojaAutorizada === loja;
}

function tratarErro(error: unknown, tag: string): CompraResult {
    if (error instanceof CompraError) return { success: false, code: error.code };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2034') return { success: false, code: 'CONFLITO_CONCORRENTE' };
        // Violação do @unique de lancamento_id: a parcela já foi confirmada por outra requisição
        if (error.code === 'P2002') return { success: false, code: 'PARCELA_JA_PAGA' };
    }
    console.error(`[${tag}] Erro inesperado:`, error);
    return { success: false, code: 'ERRO_INTERNO' };
}

// ─── Criar compra: gera todas as parcelas pendentes ──────────────────────────
export async function criarCompraCore(db: PrismaClient, auth: Autorizado, input: unknown): Promise<CompraResult> {
    try {
        const parsed = CriarCompraSchema.safeParse(input);
        if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS', message: parsed.error.issues[0]?.message };
        const d = parsed.data;

        // Loja: quem tem AMBAS escolhe; os demais ficam presos à própria loja
        let loja: Loja;
        if (auth.lojaAutorizada === 'AMBAS') {
            if (!d.loja) return { success: false, code: 'CAMPOS_INVALIDOS', message: 'Selecione a loja' };
            loja = d.loja;
        } else {
            loja = auth.lojaAutorizada;
        }

        const totalCentavos = reaisParaCentavos(d.valor_total)!; // validado no schema
        const parcelas = gerarParcelas(totalCentavos, d.qtd_parcelas, d.primeiro_vencimento);
        if (parcelas.some((p) => p.valorCentavos <= 0)) {
            return { success: false, code: 'CAMPOS_INVALIDOS', message: 'Valor total pequeno demais para essa quantidade de parcelas' };
        }

        const compra = await db.$transaction(async (tx) => {
            const criada = await tx.compraParcelada.create({
                data: {
                    descricao: d.descricao,
                    categoria: d.categoria,
                    loja,
                    valor_total: centavosParaReais(totalCentavos),
                    qtd_parcelas: d.qtd_parcelas,
                    primeiro_vencimento: isoParaDataUTC(d.primeiro_vencimento),
                    cartao_titular: d.cartao_titular,
                    cartao_banco: d.cartao_banco,
                    cartao_bandeira: d.cartao_bandeira,
                    observacao: d.observacao,
                    usuario_id: auth.userId,
                    parcelas: {
                        create: parcelas.map((p) => ({
                            numero: p.numero,
                            valor: centavosParaReais(p.valorCentavos),
                            vencimento: isoParaDataUTC(p.vencimento),
                        })),
                    },
                },
                select: { id: true },
            });
            await tx.log.create({
                data: {
                    acao: 'COMPRA_PARCELADA_CRIADA',
                    detalhe: JSON.stringify({
                        id: criada.id,
                        descricao: d.descricao,
                        loja,
                        valor_total: centavosParaReais(totalCentavos),
                        qtd_parcelas: d.qtd_parcelas,
                        primeiro_vencimento: d.primeiro_vencimento,
                        cartao_titular: d.cartao_titular,
                        parcelas: parcelas.map((p) => ({ n: p.numero, valor: centavosParaReais(p.valorCentavos), venc: p.vencimento })),
                    }),
                    usuario_id: auth.userId,
                },
            });
            return criada;
        }, TX_OPTIONS);

        return { success: true, id: compra.id };
    } catch (error) {
        return tratarErro(error, 'criarCompra');
    }
}

// ─── Editar parcela pendente (valor e vencimento) ────────────────────────────
export async function editarParcelaCore(db: PrismaClient, auth: Autorizado, input: unknown): Promise<CompraResult> {
    try {
        const parsed = EditarParcelaSchema.safeParse(input);
        if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS', message: parsed.error.issues[0]?.message };
        const novoValor = centavosParaReais(reaisParaCentavos(parsed.data.valor)!);

        await db.$transaction(async (tx) => {
            const parcela = await tx.parcelaCompra.findUnique({
                where: { id: parsed.data.id },
                include: { compra: true },
            });
            if (!parcela || !lojaPermitida(auth, parcela.compra.loja)) throw new CompraError('NAO_AUTORIZADO');
            if (parcela.compra.cancelado_at || parcela.cancelada_at) throw new CompraError('PARCELA_CANCELADA');
            if (parcela.lancamento_id) throw new CompraError('PARCELA_JA_PAGA'); // paga = travada (decisão 3)

            const alterada = await tx.parcelaCompra.updateMany({
                where: { id: parcela.id, lancamento_id: null, cancelada_at: null },
                data: { valor: novoValor, vencimento: isoParaDataUTC(parsed.data.vencimento) },
            });
            if (alterada.count !== 1) throw new CompraError('PARCELA_JA_PAGA');

            await tx.log.create({
                data: {
                    acao: 'PARCELA_EDITADA',
                    detalhe: JSON.stringify({
                        id: parcela.id,
                        compra_id: parcela.compra_id,
                        numero: parcela.numero,
                        antes: { valor: parcela.valor.toString(), vencimento: dataUTCParaIso(parcela.vencimento) },
                        depois: { valor: novoValor, vencimento: parsed.data.vencimento },
                    }),
                    usuario_id: auth.userId,
                },
            });
        }, TX_OPTIONS);

        return { success: true };
    } catch (error) {
        return tratarErro(error, 'editarParcela');
    }
}

// ─── Cancelar compra: encerra só as pendentes; as pagas permanecem ───────────
export async function cancelarCompraCore(db: PrismaClient, auth: Autorizado, input: unknown): Promise<CompraResult> {
    try {
        const parsed = CancelarCompraSchema.safeParse(input);
        if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' };

        await db.$transaction(async (tx) => {
            const compra = await tx.compraParcelada.findUnique({
                where: { id: parsed.data.id },
                include: { parcelas: true },
            });
            if (!compra || !lojaPermitida(auth, compra.loja)) throw new CompraError('NAO_AUTORIZADO');
            if (compra.cancelado_at) throw new CompraError('COMPRA_CANCELADA');

            const pendentes = compra.parcelas.filter((p) => !p.lancamento_id && !p.cancelada_at);
            if (pendentes.length === 0) throw new CompraError('SEM_PENDENTES');

            const agora = new Date();
            await tx.parcelaCompra.updateMany({
                where: { compra_id: compra.id, lancamento_id: null, cancelada_at: null },
                data: { cancelada_at: agora },
            });
            await tx.compraParcelada.update({ where: { id: compra.id }, data: { cancelado_at: agora } });
            await tx.log.create({
                data: {
                    acao: 'COMPRA_PARCELADA_CANCELADA',
                    detalhe: JSON.stringify({
                        id: compra.id,
                        descricao: compra.descricao,
                        parcelas_canceladas: pendentes.map((p) => p.numero),
                        parcelas_pagas_mantidas: compra.parcelas.filter((p) => p.lancamento_id).map((p) => p.numero),
                    }),
                    usuario_id: auth.userId,
                },
            });
        }, TX_OPTIONS);

        return { success: true };
    } catch (error) {
        return tratarErro(error, 'cancelarCompra');
    }
}

// ─── Confirmar pagamento: cria a saída realizada, sem duplicidade ────────────
// Valor = exatamente o da parcela (decisão 4). Diferença → editar a parcela antes.
export async function confirmarPagamentoCore(
    db: PrismaClient,
    auth: Autorizado,
    input: unknown,
    agora: Date = new Date(),
): Promise<CompraResult> {
    try {
        const parsed = ConfirmarPagamentoSchema.safeParse(input);
        if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS', message: parsed.error.issues[0]?.message };
        const d = parsed.data;

        const hojeBrasil = new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
        if (d.data_pagamento > hojeBrasil) return { success: false, code: 'DATA_FUTURA' };

        const lancamentoId = await db.$transaction(async (tx) => {
            const parcela = await tx.parcelaCompra.findUnique({
                where: { id: d.parcela_id },
                include: { compra: true },
            });
            if (!parcela || !lojaPermitida(auth, parcela.compra.loja)) throw new CompraError('NAO_AUTORIZADO');
            if (parcela.compra.cancelado_at || parcela.cancelada_at) throw new CompraError('PARCELA_CANCELADA');
            if (parcela.lancamento_id) throw new CompraError('PARCELA_JA_PAGA');

            const c = parcela.compra;
            const descricao = [
                `${c.descricao} (parcela ${parcela.numero}/${c.qtd_parcelas})`,
                c.categoria ? `[${c.categoria}]` : '',
                `- Cartão: ${c.cartao_titular}${c.cartao_banco ? ` ${c.cartao_banco}` : ''}`,
                d.observacao ? `- Obs: ${d.observacao}` : '',
            ].filter(Boolean).join(' ');

            const lancamento = await tx.lancamento.create({
                data: {
                    usuario_id: auth.userId,
                    tipo: 'SAIDA',
                    valor: parcela.valor,
                    descricao,
                    metodo_pgto: d.metodo_pgto,
                    loja: c.loja,
                    data_ref: isoParaDataUTC(d.data_pagamento),
                },
                select: { id: true },
            });

            // Guarda contra corrida: só marca se ainda estiver pendente. Além disso o @unique
            // de lancamento_id impede, no banco, dois lançamentos para a mesma parcela.
            const marcada = await tx.parcelaCompra.updateMany({
                where: { id: parcela.id, lancamento_id: null, cancelada_at: null },
                data: { lancamento_id: lancamento.id, paga_at: agora },
            });
            if (marcada.count !== 1) throw new CompraError('PARCELA_JA_PAGA');

            await tx.log.create({
                data: {
                    acao: 'PARCELA_PAGA',
                    detalhe: JSON.stringify({
                        parcela_id: parcela.id,
                        compra_id: c.id,
                        numero: parcela.numero,
                        valor: parcela.valor.toString(),
                        vencimento: dataUTCParaIso(parcela.vencimento),
                        data_pagamento: d.data_pagamento,
                        metodo_pgto: d.metodo_pgto,
                        lancamento_id: lancamento.id,
                    }),
                    usuario_id: auth.userId,
                },
            });
            return lancamento.id;
        }, TX_OPTIONS);

        return { success: true, id: lancamentoId };
    } catch (error) {
        return tratarErro(error, 'confirmarPagamento');
    }
}
