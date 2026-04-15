'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RolesEnum } from '@/lib/validations';
import { z } from 'zod';

type Role = z.infer<typeof RolesEnum>;

type LojaValue = 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS' | null;

interface PermissionState {
    role: Role | null;
    lojaAutorizada: LojaValue;
    lojaPadrao: 'JOAO_PESSOA' | 'SANTA_RITA' | null;
    isLoading: boolean;
    isGerente: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}

export function usePermissions(): PermissionState {
    const [state, setState] = useState<PermissionState>({
        role: null,
        lojaAutorizada: null,
        lojaPadrao: null,
        isLoading: true,
        isGerente: false,
        isAdmin: false,
        isSuperAdmin: false,
    });

    useEffect(() => {
        async function loadRole() {
            const supabase = createClient();
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    setState((s) => ({ ...s, isLoading: false }));
                    return;
                }

                const { data, error } = await supabase
                    .from('users')
                    .select('role, lojaAutorizada, lojaPadrao')
                    .eq('email', user.email)
                    .single();

                if (error || !data) {
                    setState((s) => ({ ...s, isLoading: false }));
                    return;
                }

                const role = data.role as Role;
                setState({
                    role,
                    lojaAutorizada: data.lojaAutorizada as LojaValue,
                    lojaPadrao: (data.lojaPadrao as 'JOAO_PESSOA' | 'SANTA_RITA' | null) ?? null,
                    isLoading: false,
                    isGerente: role === 'GERENTE' || role === 'ADMIN' || role === 'SUPER_ADMIN',
                    isAdmin: role === 'ADMIN' || role === 'SUPER_ADMIN',
                    isSuperAdmin: role === 'SUPER_ADMIN',
                });
            } catch (err) {
                console.error('Error fetching role:', err);
                setState((s) => ({ ...s, isLoading: false }));
            }
        }

        loadRole();
    }, []);

    return state;
}
