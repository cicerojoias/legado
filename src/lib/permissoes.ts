import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import type { Permissoes } from '@/hooks/use-permissions';

/**
 * Papel e lojas do usuário logado, lidos no servidor (P1).
 * Antes o menu descobria isso pelo navegador (2 idas à rede a cada tela).
 * Só serve para mostrar/esconder itens: rotas e ações continuam validando no banco.
 */
export const getPermissoes = cache(async (): Promise<Permissoes> => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const userId = data?.claims?.sub;
    const dbUser = userId
        ? await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true, lojaAutorizada: true, lojaPadrao: true, ativo: true },
        })
        : null;

    const role = dbUser?.ativo ? dbUser.role : null;
    return {
        role,
        lojaAutorizada: dbUser?.lojaAutorizada ?? null,
        lojaPadrao: dbUser?.lojaPadrao === 'AMBAS' ? null : (dbUser?.lojaPadrao ?? null),
        isLoading: false,
        isGerente: role === 'GERENTE' || role === 'ADMIN' || role === 'SUPER_ADMIN',
        isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
        isSuperAdmin: role === 'SUPER_ADMIN',
    };
});
