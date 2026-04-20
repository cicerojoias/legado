'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const Schema = z
    .object({
        password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: 'As senhas não coincidem',
        path: ['confirmPassword'],
    });

export async function resetPasswordAction(
    _: unknown,
    formData: FormData
): Promise<{ success: boolean; message: string } | never> {
    const parsed = Schema.safeParse({
        password: formData.get('password'),
        confirmPassword: formData.get('confirmPassword'),
    });

    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0].message };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) {
        return { success: false, message: 'Erro ao atualizar senha. Tente novamente.' };
    }

    await supabase.auth.signOut();
    redirect('/login?message=senha_atualizada');
}
