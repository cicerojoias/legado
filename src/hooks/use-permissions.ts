'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RolesEnum } from '@/lib/validations';
import { z } from 'zod';

type Role = z.infer<typeof RolesEnum>;

interface PermissionState {
    role: Role | null;
    isLoading: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}

export function usePermissions(): PermissionState {
    const [state, setState] = useState<PermissionState>({
        role: null,
        isLoading: true,
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

                // Search the custom users table for the specific role
                const { data, error } = await supabase
                    .from('users')
                    .select('role')
                    .eq('email', user.email) // Assuming user email is the main join or we join via id
                    .single();

                if (error || !data) {
                    setState((s) => ({ ...s, isLoading: false }));
                    return;
                }

                const role = data.role as Role;
                setState({
                    role,
                    isLoading: false,
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
