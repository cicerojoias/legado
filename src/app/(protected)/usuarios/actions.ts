'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { Loja } from '@prisma/client';
import { EditarUsuarioLojaSchema, EditarUsuarioAtivoSchema, EditarUsuarioSchema, ExcluirUsuarioSchema, CriarUsuarioSchema } from '@/lib/validations';

// ─── Infraestrutura ─────────────────────────────────────────────────────────

function getSupabaseAdmin() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return null;
    return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

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

// ─── Revalidar rotas ─────────────────────────────────────────────────────────

function revalidateAll() {
    revalidatePath('/usuarios', 'layout');
    revalidatePath('/hoje', 'layout');
    revalidatePath('/lancamentos', 'layout');
    revalidatePath('/relatorios', 'layout');
}

// ─── Types ──────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { success: false; error: string };

// ─── 1. Alterar Loja, Role e Ativo de uma vez (Modal de Edição) ─────────────
// Security chain: Auth → RBAC (SUPER_ADMIN) → Zod → self-guard → $transaction { read → write → audit }

export async function editUserAction(formData: FormData): Promise<ActionResult> {
    try {
        const admin = await getSuperAdmin();
        if (!admin) return { success: false, error: 'Não autorizado.' };

        const raw = {
            userId: formData.get('userId') as string,
            lojaAutorizada: formData.get('lojaAutorizada') as string,
            ativo: formData.get('ativo') === 'true',
            role: formData.get('role') as string | undefined,
        };

        const parsed = EditarUsuarioSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
        }

        // Guard: SUPER_ADMIN não pode desativar a si mesmo
        if (parsed.data.userId === admin.userId && !parsed.data.ativo) {
            return { success: false, error: 'Você não pode desativar sua própria conta.' };
        }

        // Guard: SUPER_ADMIN não pode alterar sua própria role
        if (parsed.data.userId === admin.userId && parsed.data.role && parsed.data.role !== 'SUPER_ADMIN') {
            return { success: false, error: 'Você não pode alterar sua própria role.' };
        }

        await prisma.$transaction(async (tx) => {
            const target = await tx.user.findUnique({
                where: { id: parsed.data.userId },
                select: { id: true, nome: true, lojaAutorizada: true, ativo: true, role: true },
            });

            if (!target) throw new Error('Usuário não encontrado.');

            const updateData: { lojaAutorizada: Loja; ativo: boolean; role?: 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR' } = {
                lojaAutorizada: parsed.data.lojaAutorizada as Loja,
                ativo: parsed.data.ativo,
            };

            if (parsed.data.role) {
                updateData.role = parsed.data.role;
            }

            await tx.user.update({
                where: { id: parsed.data.userId },
                data: updateData,
            });

            await tx.log.create({
                data: {
                    acao: 'USUARIO_EDITADO',
                    detalhe: JSON.stringify({
                        targetId: target.id,
                        nome: target.nome,
                        loja_antes: target.lojaAutorizada,
                        loja_depois: parsed.data.lojaAutorizada,
                        ativo_antes: target.ativo,
                        ativo_depois: parsed.data.ativo,
                        role_antes: target.role,
                        role_depois: parsed.data.role || target.role,
                    }),
                    usuario_id: admin.userId,
                },
            });
        });

        revalidateAll();
        return { success: true };

    } catch (error) {
        console.error('[editUserAction] Erro:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}

// ─── 2. Exclusão de Usuário Completa (Supabase + Local) ─────────────────────
// Security chain: Auth → RBAC (SUPER_ADMIN) → Zod → self-guard → Auth API → $transaction { hard-delete || soft-delete fallback }

export async function deleteUserAction(formData: FormData): Promise<ActionResult> {
    try {
        const admin = await getSuperAdmin();
        if (!admin) return { success: false, error: 'Não autorizado.' };

        const raw = {
            userId: formData.get('userId') as string,
        };

        const parsed = ExcluirUsuarioSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: 'ID inválido.' };
        }

        const targetId = parsed.data.userId;

        // Guard: SUPER_ADMIN não pode deletar a si mesmo
        if (targetId === admin.userId) {
            return { success: false, error: 'Você não pode excluir sua própria conta.' };
        }

        // 1. Apagar do Supabase Auth
        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
             console.error('[deleteUserAction] Supabase Admin Client não configurado ou chave faltante.');
             return { success: false, error: 'Configuração incompleta: SUPABASE_SERVICE_ROLE_KEY não encontrada no servidor.' };
        }

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(targetId);
        if (authError && (authError as any).status !== 404) {
             console.error('[deleteUserAction] Erro no Supabase Auth:', authError);
             return { success: false, error: 'Erro ao remover credenciais do servidor de autenticação.' };
        }

        // 2. Apagar/Desativar no Prisma localmente
        try {
            await prisma.$transaction(async (tx) => {
                const target = await tx.user.findUnique({
                    where: { id: targetId },
                    select: { id: true, nome: true, email: true },
                });

                if (!target) return; // Se não existe local, ignora

                // Verifica dependências antes de tentar deletar
                // Note: Se tiver Logs, também vai falhar o delete. 
                // Como queremos logs históricos, se tiver QUALQUER coisa vinculada, fazemos anonimização.
                const lancamentosCount = await tx.lancamento.count({ where: { usuario_id: targetId } });
                const logsCount = await tx.log.count({ where: { usuario_id: targetId } });

                if (lancamentosCount === 0 && logsCount === 0) {
                    await tx.user.delete({ where: { id: targetId } });
                    await tx.log.create({
                        data: {
                            acao: 'USUARIO_DELETADO',
                            detalhe: JSON.stringify({ targetId, nome: target.nome, tipo: 'HARD_DELETE' }),
                            usuario_id: admin.userId,
                        },
                    });
                } else {
                    await tx.user.update({
                        where: { id: targetId },
                        data: { 
                            ativo: false, 
                            email: `deleted_${Date.now()}_${target.email}`,
                            nome: `${target.nome} (Excluído)`,
                            pin_hash: null
                        }
                    });

                    await tx.log.create({
                        data: {
                            acao: 'USUARIO_ANONIMIZADO',
                            detalhe: JSON.stringify({ 
                                targetId, 
                                nome: target.nome, 
                                motivo: lancamentosCount > 0 ? 'Lançamentos Vinculados' : 'Logs Vinculados',
                                tipo: 'SOFT_DELETE' 
                            }),
                            usuario_id: admin.userId,
                        },
                    });
                }
            });
        } catch (dbError) {
            console.error('[deleteUserAction] Erro BD:', dbError);
            return { success: false, error: 'Autenticação removida, mas ocorreu erro no banco de dados local.' };
        }

        revalidateAll();
        return { success: true };

    } catch (error) {
        console.error('[deleteUserAction] Erro fatal:', error);
        return { success: false, error: 'Ocorreu um erro interno. Tente novamente.' };
    }
}

// ─── 3. Criar Novo Usuário (Supabase Auth + Prisma) ─────────────────────────
// Security chain: Auth → RBAC (SUPER_ADMIN) → Zod → Auth API create → $transaction { insert + audit }

export async function criarUsuarioAction(formData: FormData): Promise<ActionResult> {
    try {
        const admin = await getSuperAdmin();
        if (!admin) return { success: false, error: 'Não autorizado.' };

        const raw = {
            nome: formData.get('nome') as string,
            email: formData.get('email') as string,
            senha: formData.get('senha') as string,
            role: formData.get('role') as string,
            lojaAutorizada: formData.get('lojaAutorizada') as string,
        };

        const parsed = CriarUsuarioSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
        }

        const supabaseAdmin = getSupabaseAdmin();
        if (!supabaseAdmin || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            return { success: false, error: 'Configuração incompleta: SUPABASE_SERVICE_ROLE_KEY ausente.' };
        }

        // 1. Criar no Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: parsed.data.email,
            password: parsed.data.senha,
            email_confirm: true,
        });

        if (authError || !authData.user) {
            const msg = authError?.message ?? 'Erro desconhecido no Auth.';
            if (msg.includes('already been registered') || msg.includes('already exists')) {
                return { success: false, error: 'Este e-mail já está cadastrado no sistema de autenticação.' };
            }
            return { success: false, error: `Erro ao criar credenciais: ${msg}` };
        }

        const newUserId = authData.user.id;

        // 2. Inserir em public.users dentro de transaction
        try {
            await prisma.$transaction(async (tx) => {
                await tx.user.create({
                    data: {
                        id: newUserId,
                        nome: parsed.data.nome,
                        email: parsed.data.email,
                        role: parsed.data.role,
                        lojaAutorizada: parsed.data.lojaAutorizada as Loja,
                        ativo: true,
                    },
                });

                await tx.log.create({
                    data: {
                        acao: 'USUARIO_CRIADO',
                        detalhe: JSON.stringify({
                            targetId: newUserId,
                            nome: parsed.data.nome,
                            email: parsed.data.email,
                            role: parsed.data.role,
                            loja: parsed.data.lojaAutorizada,
                        }),
                        usuario_id: admin.userId,
                    },
                });
            });
        } catch (dbError) {
            // Rollback: remover do Auth se falhou no banco
            await supabaseAdmin.auth.admin.deleteUser(newUserId);
            console.error('[criarUsuarioAction] Erro BD, Auth revertido:', dbError);
            return { success: false, error: 'Erro ao salvar no banco de dados. Tente novamente.' };
        }

        revalidateAll();
        return { success: true };

    } catch (error) {
        console.error('[criarUsuarioAction] Erro fatal:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}

// ─── Actions Antigas (Mantidas p/ Compatibilidade se necessário) ────────────

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
