'use server';

// Compras no cartão / parceladas — docs/PLANO-COMPRAS-PARCELADAS.md
// Só ADMIN e SUPER_ADMIN (papel lido do banco, nunca do cliente).
// Cadeia: Auth → Rate limit → papel/ativo → [núcleo: Zod → $transaction(Serializable) → log] → revalidate
// A lógica transacional fica em src/lib/financeiro/compras-core.ts (testável sem Supabase).

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { rateLimit } from '@/lib/rate-limit';
import {
    cancelarCompraCore,
    confirmarPagamentoCore,
    criarCompraCore,
    editarParcelaCore,
    type Autorizado,
    type CompraResult,
} from '@/lib/financeiro/compras-core';

const MUTACAO_MAX_RPM = 30;

async function autorizarAdmin(): Promise<{ ok: true; auth: Autorizado } | { ok: false; result: CompraResult }> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, result: { success: false, code: 'NAO_AUTORIZADO' } };

    const rl = await rateLimit(`mutacao:${user.id}`, MUTACAO_MAX_RPM);
    if (!rl.success) return { ok: false, result: { success: false, code: 'RATE_LIMIT', message: rl.message } };

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { ativo: true, role: true, lojaAutorizada: true },
    });
    if (!dbUser || !dbUser.ativo) return { ok: false, result: { success: false, code: 'USUARIO_INATIVO' } };
    if (dbUser.role !== 'ADMIN' && dbUser.role !== 'SUPER_ADMIN') {
        return { ok: false, result: { success: false, code: 'NAO_AUTORIZADO' } };
    }
    return { ok: true, auth: { userId: user.id, lojaAutorizada: dbUser.lojaAutorizada } };
}

function revalidar() {
    revalidatePath('/hoje');
    revalidatePath('/lancamentos', 'layout');
}

async function executar(
    operacao: (auth: Autorizado) => Promise<CompraResult>,
): Promise<CompraResult> {
    const a = await autorizarAdmin();
    if (!a.ok) return a.result;
    const resultado = await operacao(a.auth);
    if (resultado.success) revalidar();
    return resultado;
}

export type CartaoUsado = { titular: string; banco: string | null; bandeira: string | null };

// Cartões já usados em compras anteriores (sugestão no cadastro). Só ADMIN+, filtrado pela loja do usuário.
export async function listarCartoes(): Promise<{ success: true; cartoes: CartaoUsado[] } | { success: false }> {
    const a = await autorizarAdmin();
    if (!a.ok) return { success: false };
    const brutos = await prisma.compraParcelada.findMany({
        where: a.auth.lojaAutorizada === 'AMBAS' ? {} : { loja: a.auth.lojaAutorizada },
        distinct: ['cartao_titular', 'cartao_banco', 'cartao_bandeira'],
        select: { cartao_titular: true, cartao_banco: true, cartao_bandeira: true },
        orderBy: { created_at: 'desc' },
        take: 30,
    });
    return {
        success: true,
        cartoes: brutos.map((c) => ({ titular: c.cartao_titular, banco: c.cartao_banco, bandeira: c.cartao_bandeira })),
    };
}

export async function criarCompra(input: unknown): Promise<CompraResult> {
    return executar((auth) => criarCompraCore(prisma, auth, input));
}

export async function editarParcela(input: unknown): Promise<CompraResult> {
    return executar((auth) => editarParcelaCore(prisma, auth, input));
}

export async function cancelarCompra(input: unknown): Promise<CompraResult> {
    return executar((auth) => cancelarCompraCore(prisma, auth, input));
}

export async function confirmarPagamento(input: unknown): Promise<CompraResult> {
    return executar((auth) => confirmarPagamentoCore(prisma, auth, input));
}
