'use server';

import { createClient } from '@/lib/supabase/server';
import { LoginSchema } from '@/lib/validations';
import { redirect } from 'next/navigation';
import { rateLimit } from '@/lib/rate-limit';

export async function loginAction(formData: FormData) {
    // Extract inputs
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // Apply Rate Limiting based on email
    const limitCheck = await rateLimit(`login:${email}`);
    if (!limitCheck.success) {
        return {
            success: false,
            message: limitCheck.message,
        };
    }

    // Validate on the server side using the precise Zod schema
    const validationResult = LoginSchema.safeParse({ email, password });

    if (!validationResult.success) {
        // Return early with masked error to prevent leaking stack traces
        return {
            success: false,
            message: 'Formato de credenciais inválido. Verifique o seu e-mail e senha.',
            errors: validationResult.error.flatten().fieldErrors,
        };
    }

    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
        email: validationResult.data.email,
        password: validationResult.data.password,
    });

    if (error) {
        // Sanitize the error message before sending to the client UI
        console.error('Login error:', error.message);
        return {
            success: false,
            message: 'Credenciais inválidas ou e-mail não cadastrado.',
        };
    }

    // If successful, redirect to the PIN validation
    redirect('/pin');
}
