'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { FastAuthPinSchema, SetupPinSchema } from '@/lib/validations';
import { hashPin, comparePin } from '@/lib/pin-utils';

// Bloqueio de 15 minutos após 3 tentativas erradas
const LOCKOUT_MINUTES = 15;
const MAX_ATTEMPTS = 3;

export async function setupPinAction(pin: string, confirmPin: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, message: 'Usuário não autenticado.' };
    }

    const validation = SetupPinSchema.safeParse({ pin, confirmPin });
    if (!validation.success) {
        return { success: false, message: validation.error.issues[0].message };
    }

    // Verifica se a tabela local tem o perfil e se já tem PIN
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

    if (!dbUser) {
        return { success: false, message: 'Perfil não encontrado na base de dados. Sincronize com o admin.' };
    }

    if (dbUser.pin_hash) {
        return { success: false, message: 'Seu PIN já está configurado.' };
    }

    const hashed = hashPin(pin);

    await prisma.user.update({
        where: { id: user.id },
        data: { pin_hash: hashed },
    });

    const cookieStore = await cookies();
    cookieStore.set(`pin_verified_${user.id}`, 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 12, // 12 horas - depois vai pedir o PIN de novo
    });

    return { success: true };
}

export async function verifyPinAction(pin: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, message: 'Usuário não autenticado.' };
    }

    const validation = FastAuthPinSchema.safeParse({ pin });
    if (!validation.success) {
        return { success: false, message: validation.error.issues[0].message };
    }

    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) {
        return { success: false, message: 'Perfil não encontrado.' };
    }

    if (!dbUser.pin_hash) {
        return { success: false, message: 'PIN não configurado. Redirecionando...', redirect: '/setup-pin' };
    }

    // Verifica Lockout
    if (dbUser.bloqueado_ate && dbUser.bloqueado_ate > new Date()) {
        const minLeft = Math.ceil((dbUser.bloqueado_ate.getTime() - Date.now()) / 60000);
        return { success: false, message: `Conta bloqueada devido a múltiplas tentativas falhas. Tente novamente em ${minLeft} minutos.` };
    }

    const isMatch = comparePin(pin, dbUser.pin_hash);

    if (!isMatch) {
        const tentativas = dbUser.pin_tentativas + 1;
        let bloqueadoAte = null;

        if (tentativas >= MAX_ATTEMPTS) {
            bloqueadoAte = new Date(Date.now() + LOCKOUT_MINUTES * 60000);
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                pin_tentativas: tentativas,
                bloqueado_ate: bloqueadoAte
            },
        });

        if (bloqueadoAte) {
            return { success: false, message: `Muitas tentativas falhas. PIN bloqueado por ${LOCKOUT_MINUTES} minutos.` };
        }

        return { success: false, message: `PIN incorreto. Você tem mais ${MAX_ATTEMPTS - tentativas} tentativa(s).` };
    }

    // PIN correto -> Reseta contador e cria cookie
    await prisma.user.update({
        where: { id: user.id },
        data: { pin_tentativas: 0, bloqueado_ate: null },
    });

    const cookieStore = await cookies();
    cookieStore.set(`pin_verified_${user.id}`, 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 12, // Exige novo PIN a cada 12 horas (expiração na janela ativa)
    });

    return { success: true };
}
