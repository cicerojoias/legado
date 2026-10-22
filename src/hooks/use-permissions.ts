'use client';

import { createContext, createElement, useContext } from 'react';

type Role = 'SUPER_ADMIN' | 'ADMIN' | 'GERENTE' | 'OPERADOR';

type LojaValue = 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS' | null;

export interface Permissoes {
    role: Role | null;
    lojaAutorizada: LojaValue;
    lojaPadrao: 'JOAO_PESSOA' | 'SANTA_RITA' | null;
    isLoading: boolean;
    isGerente: boolean;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}

const SEM_PERMISSAO: Permissoes = {
    role: null,
    lojaAutorizada: null,
    lojaPadrao: null,
    isLoading: false,
    isGerente: false,
    isAdmin: false,
    isSuperAdmin: false,
};

const PermissoesContext = createContext<Permissoes>(SEM_PERMISSAO);

/** Recebe as permissões prontas do servidor (layout protegido) e repassa aos componentes. */
export function PermissoesProvider({ value, children }: { value: Permissoes; children: React.ReactNode }) {
    return createElement(PermissoesContext.Provider, { value }, children);
}

/** Papel do usuário para mostrar/esconder itens na tela. Já vem pronto: sem busca no navegador. */
export function usePermissions(): Permissoes {
    return useContext(PermissoesContext);
}
