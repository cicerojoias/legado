'use server';

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Loja } from '@prisma/client';
import { CriarCustoFixoSchema, EditarCustoFixoSchema, DeleteQuerySchema } from '@/lib/validations';

// ─── Verificação de identidade e role ────────────────────────────────────────

async function getSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, ativo: true },
    });

    if (!dbUser || !dbUser.ativo || dbUser.role !== 'SUPER_ADMIN') return null;
    return { userId: user.id };
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { success: false; error: string };

export async function criarCustoFixo(formData: FormData): Promise<ActionResult> {
    const admin = await getSuperAdmin();
    if (!admin) return { success: false, error: 'Não autorizado.' };

    const raw = {
        nome:     formData.get('nome')     as string,
        valor:    formData.get('valor')    as string,
        loja:     formData.get('loja')     as string,
        dia_venc: formData.get('dia_venc') as string,
    };

    const parsed = CriarCustoFixoSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
    }

    const { nome, valor, loja, dia_venc } = parsed.data;

    await prisma.$transaction(async (tx) => {
        const custo = await tx.custoFixo.create({
            data: {
                nome,
                valor: parseFloat(valor),
                loja: loja as Loja,
                dia_venc,
                ativo: true,
                usuario_id: admin.userId,
            },
        });

        await tx.log.create({
            data: {
                acao: 'CUSTO_FIXO_CRIADO',
                detalhe: JSON.stringify({ id: custo.id, nome, valor, loja, dia_venc }),
                usuario_id: admin.userId,
            },
        });
    });

    revalidatePath('/custos-fixos', 'layout');
    return { success: true };
}

export async function editarCustoFixo(formData: FormData): Promise<ActionResult> {
    const admin = await getSuperAdmin();
    if (!admin) return { success: false, error: 'Não autorizado.' };

    const raw = {
        id:       formData.get('id')       as string,
        nome:     formData.get('nome')     as string,
        valor:    formData.get('valor')    as string,
        loja:     formData.get('loja')     as string,
        dia_venc: formData.get('dia_venc') as string,
    };

    const parsed = EditarCustoFixoSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
    }

    const { id, nome, valor, loja, dia_venc } = parsed.data;

    await prisma.$transaction(async (tx) => {
        const antes = await tx.custoFixo.findUnique({ where: { id } });
        if (!antes) throw new Error('Custo fixo não encontrado.');

        await tx.custoFixo.update({
            where: { id },
            data: { nome, valor: parseFloat(valor), loja: loja as Loja, dia_venc },
        });

        await tx.log.create({
            data: {
                acao: 'CUSTO_FIXO_EDITADO',
                detalhe: JSON.stringify({
                    id,
                    antes: { nome: antes.nome, valor: antes.valor.toString(), loja: antes.loja },
                    depois: { nome, valor, loja },
                }),
                usuario_id: admin.userId,
            },
        });
    });

    revalidatePath('/custos-fixos', 'layout');
    return { success: true };
}

export async function toggleCustoFixo(id: string): Promise<ActionResult> {
    const admin = await getSuperAdmin();
    if (!admin) return { success: false, error: 'Não autorizado.' };

    const parsed = DeleteQuerySchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: 'ID inválido.' };

    await prisma.$transaction(async (tx) => {
        const custo = await tx.custoFixo.findUnique({ where: { id: parsed.data.id } });
        if (!custo) throw new Error('Custo fixo não encontrado.');

        await tx.custoFixo.update({
            where: { id: parsed.data.id },
            data: { ativo: !custo.ativo },
        });

        await tx.log.create({
            data: {
                acao: custo.ativo ? 'CUSTO_FIXO_DESATIVADO' : 'CUSTO_FIXO_ATIVADO',
                detalhe: JSON.stringify({ id: custo.id, nome: custo.nome }),
                usuario_id: admin.userId,
            },
        });
    });

    revalidatePath('/custos-fixos', 'layout');
    return { success: true };
}

export async function deletarCustoFixo(id: string): Promise<ActionResult> {
    const admin = await getSuperAdmin();
    if (!admin) return { success: false, error: 'Não autorizado.' };

    const parsed = DeleteQuerySchema.safeParse({ id });
    if (!parsed.success) return { success: false, error: 'ID inválido.' };

    await prisma.$transaction(async (tx) => {
        const custo = await tx.custoFixo.findUnique({ where: { id: parsed.data.id } });
        if (!custo) throw new Error('Custo fixo não encontrado.');

        await tx.custoFixo.delete({ where: { id: parsed.data.id } });

        await tx.log.create({
            data: {
                acao: 'CUSTO_FIXO_DELETADO',
                detalhe: JSON.stringify({ id: custo.id, nome: custo.nome, valor: custo.valor.toString() }),
                usuario_id: admin.userId,
            },
        });
    });

    revalidatePath('/custos-fixos', 'layout');
    return { success: true };
}
