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
            lojaAutorizada: true,
            lojaPadrao: true,
            notif_push: true,
            notif_horario: true,
        },
    });

    if (!dbUser) redirect('/login');

    return (
        <div className="min-h-full">
            <Suspense fallback={null}>
                <div className="mx-auto max-w-2xl px-4 md:px-0">
                    <PerfilContent
                        nome={dbUser.nome}
                        email={dbUser.email}
                        role={dbUser.role}
                        lojaAutorizada={dbUser.lojaAutorizada}
                        lojaPadrao={dbUser.lojaPadrao}
                        notifPush={dbUser.notif_push}
                        notifHorario={dbUser.notif_horario}
                    />
                </div>
            </Suspense>
        </div>
    );
}
