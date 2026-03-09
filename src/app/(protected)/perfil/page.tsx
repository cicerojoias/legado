import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PerfilContent } from './perfil-content';

export default async function PerfilPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            nome: true,
            email: true,
            role: true,
            notif_push: true,
            notif_horario: true,
        },
    });

    if (!dbUser) redirect('/login');

    return (
        <div className="min-h-full">
            <Suspense fallback={null}>
                <PerfilContent
                    nome={dbUser.nome}
                    email={dbUser.email}
                    role={dbUser.role}
                    notifPush={dbUser.notif_push}
                    notifHorario={dbUser.notif_horario}
                />
            </Suspense>
        </div>
    );
}
