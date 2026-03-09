'use server';

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Loja } from '@prisma/client';
import { EditarUsuarioLojaSchema, EditarUsuarioAtivoSchema } from '@/lib/validations';

// ─── Verificação de identidade e role ────────────────────────────────────────

async function getSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { id: true, role: true, ativo: true },
    });

    if (!dbUser || !dbUser.ativo || dbUser.role !== 'SUPER_ADMIN') return null;
    return { userId: dbUser.id };
}

// ─── Revalidar todas as rotas afetadas por mudança de usuário ────────────────

function revalidateAll() {
    revalidatePath('/usuarios', 'layout');
    revalidatePath('/hoje', 'layout');
    revalidatePath('/lancamentos', 'layout');
    revalidatePath('/relatorios', 'layout');
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { success: false; error: string };

// ─── 1. Alterar Loja Autorizada ─────────────────────────────────────────────
// Security chain: Auth → RBAC (SUPER_ADMIN) → Zod → $transaction { read → write → audit }

export async function alterarLojaUsuario(formData: FormData): Promise<ActionResult> {
    try {
        const admin = await getSuperAdmin();
        if (!admin) return { success: false, error: 'Não autorizado.' };

        const raw = {
            userId: formData.get('userId') as string,
            lojaAutorizada: formData.get('lojaAutorizada') as string,
        };

        const parsed = EditarUsuarioLojaSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
        }

        await prisma.$transaction(async (tx) => {
            const target = await tx.user.findUnique({
                where: { id: parsed.data.userId },
                select: { id: true, nome: true, lojaAutorizada: true },
            });

            if (!target) throw new Error('Usuário não encontrado.');

            await tx.user.update({
                where: { id: parsed.data.userId },
                data: { lojaAutorizada: parsed.data.lojaAutorizada as Loja },
            });

            await tx.log.create({
                data: {
                    acao: 'USUARIO_LOJA_ALTERADA',
                    detalhe: JSON.stringify({
                        targetId: target.id,
                        nome: target.nome,
                        antes: target.lojaAutorizada,
                        depois: parsed.data.lojaAutorizada,
                    }),
                    usuario_id: admin.userId,
                },
            });
        });

        revalidateAll();
        return { success: true };

    } catch (error) {
        console.error('[alterarLojaUsuario] Erro:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}

// ─── 2. Toggle Ativo/Inativo ────────────────────────────────────────────────
// Security chain: Auth → RBAC (SUPER_ADMIN) → Zod → self-guard → $transaction { read → write → audit }

export async function toggleAtivoUsuario(formData: FormData): Promise<ActionResult> {
    try {
        const admin = await getSuperAdmin();
        if (!admin) return { success: false, error: 'Não autorizado.' };

        const raw = {
            userId: formData.get('userId') as string,
            ativo: formData.get('ativo') === 'true',
        };

        const parsed = EditarUsuarioAtivoSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
        }

        // Guard: SUPER_ADMIN não pode desativar a si mesmo
        if (parsed.data.userId === admin.userId && !parsed.data.ativo) {
            return { success: false, error: 'Você não pode desativar sua própria conta.' };
        }

        await prisma.$transaction(async (tx) => {
            const target = await tx.user.findUnique({
                where: { id: parsed.data.userId },
                select: { id: true, nome: true, ativo: true },
            });

            if (!target) throw new Error('Usuário não encontrado.');

            await tx.user.update({
                where: { id: parsed.data.userId },
                data: { ativo: parsed.data.ativo },
            });

            await tx.log.create({
                data: {
                    acao: parsed.data.ativo ? 'USUARIO_ATIVADO' : 'USUARIO_DESATIVADO',
                    detalhe: JSON.stringify({
                        targetId: target.id,
                        nome: target.nome,
                    }),
                    usuario_id: admin.userId,
                },
            });
        });

        revalidateAll();
        return { success: true };

    } catch (error) {
        console.error('[toggleAtivoUsuario] Erro:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}
