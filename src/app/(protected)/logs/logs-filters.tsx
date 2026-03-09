'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { cn } from '@/lib/utils';

// ─── Action labels ──────────────────────────────────────────────────────────

const ACOES: { value: string; label: string }[] = [
    { value: '', label: 'Todas as ações' },
    { value: 'LANCAMENTO_CRIADO', label: 'Lançamento criado' },
    { value: 'LANCAMENTO_EDITADO', label: 'Lançamento editado' },
    { value: 'LANCAMENTO_DELETADO', label: 'Lançamento deletado' },
    { value: 'CUSTO_FIXO_CRIADO', label: 'Custo fixo criado' },
    { value: 'CUSTO_FIXO_EDITADO', label: 'Custo fixo editado' },
    { value: 'CUSTO_FIXO_DELETADO', label: 'Custo fixo deletado' },
    { value: 'PIN_ALTERADO', label: 'PIN alterado' },
    { value: 'SENHA_ALTERADA', label: 'Senha alterada' },
    { value: 'SESSAO_ENCERRADA', label: 'Sessão encerrada' },
    { value: 'NOTIFICACOES_ATUALIZADAS', label: 'Notificações atualizadas' },
    { value: 'USUARIO_LOJA_ALTERADA', label: 'Loja alterada' },
    { value: 'USUARIO_ATIVADO', label: 'Usuário ativado' },
    { value: 'USUARIO_DESATIVADO', label: 'Usuário desativado' },
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface LogsFiltersProps {
    usuarios: { id: string; nome: string }[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function LogsFilters({ usuarios }: LogsFiltersProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const currentUsuario = searchParams.get('usuario') ?? '';
    const currentAcao = searchParams.get('acao') ?? '';

    const updateParam = useCallback(
        (key: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) {
                params.set(key, value);
            } else {
                params.delete(key);
            }
            // Reset page when changing filters
            params.delete('page');
            router.push(`${pathname}?${params.toString()}`);
        },
        [searchParams, router, pathname]
    );

    return (
        <div className="flex gap-2">
            <select
                value={currentUsuario}
                onChange={(e) => updateParam('usuario', e.target.value)}
                className={cn(
                    "flex-1 h-9 rounded-lg border bg-card px-3 text-xs",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20"
                )}
            >
                <option value="">Todos os usuários</option>
                {usuarios.map((u) => (
                    <option key={u.id} value={u.id}>
                        {u.nome}
                    </option>
                ))}
            </select>

            <select
                value={currentAcao}
                onChange={(e) => updateParam('acao', e.target.value)}
                className={cn(
                    "flex-1 h-9 rounded-lg border bg-card px-3 text-xs",
                    "focus:outline-none focus:ring-2 focus:ring-primary/20"
                )}
            >
                {ACOES.map((a) => (
                    <option key={a.value} value={a.value}>
                        {a.label}
                    </option>
                ))}
            </select>
        </div>
    );
}
