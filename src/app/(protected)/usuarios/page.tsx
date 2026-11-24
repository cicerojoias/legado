import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { UsuariosContent } from './usuarios-content';

function UsuariosSkeleton() {
    return (
        <div className="p-4 space-y-3">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
        </div>
    );
}

async function UsuariosData() {
    const usuarios = await prisma.user.findMany({
        where: { ativo: true },
        select: {
            id: true,
            nome: true,
            email: true,
            role: true,
            ativo: true,
        },
        orderBy: [
            { role: 'asc' },
            { nome: 'asc' },
        ],
    });

    return <UsuariosContent usuarios={usuarios} />;
}

export default async function UsuariosPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, ativo: true },
    });

    if (!dbUser || !dbUser.ativo) redirect('/login');
    if (dbUser.role !== 'SUPER_ADMIN') redirect('/hoje');

    return (
        <div className="flex flex-col h-full">
            <div className="px-4 pt-4 pb-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-lg font-semibold">Usuários</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Gerencie os acessos da loja de Santa Rita
                </p>
            </div>

            <Suspense fallback={<UsuariosSkeleton />}>
                <UsuariosData />
            </Suspense>
        </div>
    );
}
