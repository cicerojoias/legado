'use server';

import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function logoutAction() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Clear the user-specific PIN cookie (httpOnly — can only be deleted server-side)
    if (user) {
        const cookieStore = await cookies();
        cookieStore.delete(`pin_verified_${user.id}`);
    }

    await supabase.auth.signOut();
    redirect('/login');
}
