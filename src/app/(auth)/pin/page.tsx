import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { PinVerificationClient } from './pin-client';

export default async function PinPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Middleware already protects this, but sanity check
    if (!user) {
        redirect('/login');
    }

    // Check if the user has a PIN configured in Prisma
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { pin_hash: true, nome: true },
    });

    if (!dbUser?.pin_hash) {
        // First access, redirect to setup
        redirect('/setup-pin');
    }

    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen">Carregando...</div>}>
            <PinVerificationClient userName={dbUser.nome} />
        </Suspense>
    );
}
