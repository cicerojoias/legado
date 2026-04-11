'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@prisma/client';
import { rateLimit } from '@/lib/rate-limit';
import { hashPin, comparePin } from '@/lib/pin-utils';
import {
    TrocarPinSchema,
    AlterarSenhaSchema,
    AtualizarNotificacoesSchema,
    EditarLojaPadraoSchema,
} from '@/lib/validations';

// ─── Tipos ──────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { success: false; error: string };

// ─── Constantes ─────────────────────────────────────────────────────────────

const MAX_PIN_ATTEMPTS = 3;
const LOCKOUT_MINUTES = 15;

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getAuthenticatedUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            email: true,
            ativo: true,
            role: true,
            pin_hash: true,
            pin_tentativas: true,
            bloqueado_ate: true,
        },
    });

    if (!dbUser || !dbUser.ativo) return null;
    return { supabase, authUser: user, dbUser };
}

// ─── 1. Trocar PIN ──────────────────────────────────────────────────────────
// Security chain: Auth → Rate Limit → Zod → ativo check → $transaction(Serializable)
// { comparePin(atual) → se falhar: lockout → se acertar: hashPin(novo) → audit log }

export async function trocarPinAction(formData: FormData): Promise<ActionResult> {
    try {
        const ctx = await getAuthenticatedUser();
        if (!ctx) return { success: false, error: 'Não autorizado.' };

        const { dbUser } = ctx;

        // Rate limit
        const rl = await rateLimit(`pin-change:${dbUser.id}`, 5);
        if (!rl.success) return { success: false, error: rl.message ?? 'Muitas tentativas.' };

        // Zod
        const raw = {
            pinAtual: formData.get('pinAtual') as string,
            novoPin: formData.get('novoPin') as string,
            confirmarPin: formData.get('confirmarPin') as string,
        };
        const parsed = TrocarPinSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
        }

        // Verificar lockout ativo
        if (dbUser.bloqueado_ate && dbUser.bloqueado_ate > new Date()) {
            const minLeft = Math.ceil((dbUser.bloqueado_ate.getTime() - Date.now()) / 60000);
            return { success: false, error: `Conta bloqueada. Tente novamente em ${minLeft} minutos.` };
        }

        // PIN hash obrigatório
        if (!dbUser.pin_hash) {
            return { success: false, error: 'PIN não configurado.' };
        }

        // $transaction Serializable — atômico: compare + write + audit
        await prisma.$transaction(async (tx) => {
            // Re-read dentro da transação para evitar TOCTOU
            const freshUser = await tx.user.findUnique({
                where: { id: dbUser.id },
                select: { pin_hash: true, pin_tentativas: true, bloqueado_ate: true },
            });

            if (!freshUser || !freshUser.pin_hash) {
                throw new Error('PIN_NAO_ENCONTRADO');
            }

            // Verificar PIN atual
            const isMatch = comparePin(parsed.data.pinAtual, freshUser.pin_hash);

            if (!isMatch) {
                const tentativas = freshUser.pin_tentativas + 1;
                const bloqueadoAte = tentativas >= MAX_PIN_ATTEMPTS
                    ? new Date(Date.now() + LOCKOUT_MINUTES * 60000)
                    : null;

                await tx.user.update({
                    where: { id: dbUser.id },
                    data: { pin_tentativas: tentativas, bloqueado_ate: bloqueadoAte },
                });

                if (bloqueadoAte) {
                    throw new Error(`BLOQUEADO:${LOCKOUT_MINUTES}`);
                }
                throw new Error(`PIN_INCORRETO:${MAX_PIN_ATTEMPTS - tentativas}`);
            }

            // PIN correto — atualizar hash e resetar tentativas
            await tx.user.update({
                where: { id: dbUser.id },
                data: {
                    pin_hash: hashPin(parsed.data.novoPin),
                    pin_tentativas: 0,
                    bloqueado_ate: null,
                },
            });

            // Audit log
            await tx.log.create({
                data: {
                    acao: 'PIN_ALTERADO',
                    detalhe: 'PIN alterado com sucesso pelo próprio usuário.',
                    usuario_id: dbUser.id,
                },
            });
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000,
        });

        return { success: true };

    } catch (error) {
        if (error instanceof Error) {
            if (error.message.startsWith('BLOQUEADO:')) {
                const min = error.message.split(':')[1];
                return { success: false, error: `Muitas tentativas. PIN bloqueado por ${min} minutos.` };
            }
            if (error.message.startsWith('PIN_INCORRETO:')) {
                const restantes = error.message.split(':')[1];
                return { success: false, error: `PIN atual incorreto. Resta(m) ${restantes} tentativa(s).` };
            }
            if (error.message === 'PIN_NAO_ENCONTRADO') {
                return { success: false, error: 'PIN não configurado.' };
            }
        }
        // P2034: conflito de serialização
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2034'
        ) {
            return { success: false, error: 'Conflito de concorrência. Tente novamente.' };
        }
        console.error('[trocarPinAction] Erro inesperado:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}

// ─── 2. Alterar Senha ───────────────────────────────────────────────────────
// Security chain: Auth → Rate Limit → Zod → signInWithPassword (re-autenticação)
// → updateUser({ password }) → audit log
// QA R1: NUNCA alterar senha sem provar identidade com a senha atual.

export async function alterarSenhaAction(formData: FormData): Promise<ActionResult> {
    try {
        const ctx = await getAuthenticatedUser();
        if (!ctx) return { success: false, error: 'Não autorizado.' };

        const { supabase, dbUser } = ctx;

        // Rate limit
        const rl = await rateLimit(`senha:${dbUser.id}`, 5);
        if (!rl.success) return { success: false, error: rl.message ?? 'Muitas tentativas.' };

        // Zod
        const raw = {
            senhaAtual: formData.get('senhaAtual') as string,
            novaSenha: formData.get('novaSenha') as string,
            confirmarSenha: formData.get('confirmarSenha') as string,
        };
        const parsed = AlterarSenhaSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
        }

        // Re-autenticação: provar identidade com a senha atual
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: dbUser.email,
            password: parsed.data.senhaAtual,
        });

        if (signInError) {
            return { success: false, error: 'Senha atual incorreta.' };
        }

        // Alterar senha
        const { error: updateError } = await supabase.auth.updateUser({
            password: parsed.data.novaSenha,
        });

        if (updateError) {
            return { success: false, error: 'Erro ao atualizar senha. Tente novamente.' };
        }

        // Audit log
        await prisma.log.create({
            data: {
                acao: 'SENHA_ALTERADA',
                detalhe: 'Senha alterada com sucesso pelo próprio usuário.',
                usuario_id: dbUser.id,
            },
        });

        return { success: true };

    } catch (error) {
        console.error('[alterarSenhaAction] Erro inesperado:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}

// ─── 3. Encerrar Sessão ─────────────────────────────────────────────────────
// Limpa cookie PIN + signOut Supabase + audit log + redirect

export async function encerrarSessaoAction(): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
        // Audit log antes de destruir a sessão
        await prisma.log.create({
            data: {
                acao: 'SESSAO_ENCERRADA',
                detalhe: 'Sessão encerrada pelo próprio usuário.',
                usuario_id: user.id,
            },
        });

        // Limpar cookie PIN
        const cookieStore = await cookies();
        cookieStore.delete(`pin_verified_${user.id}`);

        // Limpar push subscriptions — falha não deve bloquear o logout
        try {
            await prisma.waPushSubscription.deleteMany({ where: { userId: user.id } });
        } catch (e) {
            console.error('[logout] push subscription cleanup failed:', e);
        }
    }

    await supabase.auth.signOut();
    redirect('/login');
}

// ─── 4. Atualizar Notificações ──────────────────────────────────────────────
// RBAC: ADMIN+ apenas. Zod valida HH:MM estrito.

export async function atualizarNotificacoesAction(formData: FormData): Promise<ActionResult> {
    try {
        const ctx = await getAuthenticatedUser();
        if (!ctx) return { success: false, error: 'Não autorizado.' };

        const { dbUser } = ctx;

        // RBAC: apenas ADMIN e SUPER_ADMIN
        if (dbUser.role === 'OPERADOR') {
            return { success: false, error: 'Sem permissão.' };
        }

        // Zod
        const raw = {
            notif_push: formData.get('notif_push') === 'true',
            notif_horario: formData.get('notif_horario') as string,
        };
        const parsed = AtualizarNotificacoesSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
        }

        await prisma.user.update({
            where: { id: dbUser.id },
            data: {
                notif_push: parsed.data.notif_push,
                notif_horario: parsed.data.notif_horario,
            },
        });

        // Audit log
        await prisma.log.create({
            data: {
                acao: 'NOTIFICACOES_ATUALIZADAS',
                detalhe: JSON.stringify({
                    notif_push: parsed.data.notif_push,
                    notif_horario: parsed.data.notif_horario,
                }),
                usuario_id: dbUser.id,
            },
        });

        revalidatePath('/perfil', 'layout');
        return { success: true };

    } catch (error) {
        console.error('[atualizarNotificacoesAction] Erro inesperado:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}

// ─── 5. Atualizar Loja Padrão ───────────────────────────────────────────────

export async function atualizarLojaPadraoAction(formData: FormData): Promise<ActionResult> {
    try {
        const ctx = await getAuthenticatedUser();
        if (!ctx) return { success: false, error: 'Não autorizado.' };

        const { dbUser } = ctx;

        const rawVal = formData.get('lojaPadrao');
        const raw = {
            lojaPadrao: rawVal === 'null' || !rawVal ? null : (rawVal as string),
        };
        
        const parsed = EditarLojaPadraoSchema.safeParse(raw);
        if (!parsed.success) {
            return { success: false, error: parsed.error.issues[0]?.message ?? 'Campos inválidos.' };
        }

        await prisma.user.update({
            where: { id: dbUser.id },
            data: {
                lojaPadrao: parsed.data.lojaPadrao,
            },
        });

        revalidatePath('/perfil', 'layout');
        revalidatePath('/hoje', 'layout'); // Força update do header de hoje
        await prisma.log.create({
            data: {
                acao: 'LOJA_PADRAO_ALTERADA',
                detalhe: JSON.stringify({
                    lojaPadrao: parsed.data.lojaPadrao,
                }),
                usuario_id: dbUser.id,
            },
        });
        return { success: true };

    } catch (error) {
        console.error('[atualizarLojaPadraoAction] Erro inesperado:', error);
        return { success: false, error: 'Erro interno. Tente novamente.' };
    }
}
