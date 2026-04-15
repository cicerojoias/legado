'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Home, PieChart, User, Plus } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { usePermissions } from '@/hooks/use-permissions';
import { useWabUnreadTotal } from '@/hooks/use-wab-unread-total';
import { cn } from '@/lib/utils';
import * as motion from 'framer-motion/client';
import { Suspense } from 'react';
import { LancamentoModal } from '@/components/financeiro/lancamento-modal';

export function BottomNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { isGerente, isAdmin, isLoading, lojaAutorizada, lojaPadrao } = usePermissions();
    const wabUnread = useWabUnreadTotal();

    // Loja da URL tem prioridade; se não tiver, usa a lojaPadrao; fallback: JOAO_PESSOA
    const lojaUrl = searchParams.get('loja') as 'JOAO_PESSOA' | 'SANTA_RITA' | null;
    const defaultLoja: 'JOAO_PESSOA' | 'SANTA_RITA' =
        lojaUrl ?? lojaPadrao ?? 'JOAO_PESSOA';

    // Pode selecionar loja: admin OU usuário com acesso a ambas as lojas
    const canSelectLoja = isAdmin || lojaAutorizada === 'AMBAS';

    let links = [];

    if (!isLoading && isAdmin) {
        // Admin+: 5 itens (Hoje, WAB, Registrar, Relatórios, Perfil)
        links = [
            { href: '/hoje', icon: Home, label: 'Hoje' },
            { href: '/inbox', icon: WhatsAppIcon, label: 'WAB' },
            { href: '#', icon: Plus, label: 'Registrar' },
            { href: '/relatorios', icon: PieChart, label: 'Relatórios' },
            { href: '/perfil', icon: User, label: 'Perfil' },
        ];
    } else if (!isLoading && isGerente) {
        // Gerente: 4 itens (Hoje, WAB, Registrar, Perfil)
        links = [
            { href: '/hoje', icon: Home, label: 'Hoje' },
            { href: '/inbox', icon: WhatsAppIcon, label: 'WAB' },
            { href: '#', icon: Plus, label: 'Registrar' },
            { href: '/perfil', icon: User, label: 'Perfil' },
        ];
    } else {
        // Operador: 3 itens (Hoje, Registrar, Perfil)
        links = [
            { href: '/hoje', icon: Home, label: 'Hoje' },
            { href: '#', icon: Plus, label: 'Registrar' },
            { href: '/perfil', icon: User, label: 'Perfil' },
        ];
    }

    const isSandbox = pathname === '/sandbox';

    return (
        <nav className={cn(
            "flex items-center justify-around w-full h-16 bg-card pb-[env(safe-area-inset-bottom)] px-2",
            !isSandbox && "border-t"
        )}>
            {links.map((link) => {
                if (link.label === 'Registrar') {
                    return (
                        <div key="registrar" className="relative flex flex-col items-center justify-center w-full h-full gap-1 pt-1">
                            <Suspense fallback={
                                <div className="p-2 rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/20">
                                    <Plus className="w-5 h-5" />
                                </div>
                            }>
                                <LancamentoModal
                                    canSelectLoja={canSelectLoja}
                                    defaultLoja={defaultLoja}
                                />
                            </Suspense>
                        </div>
                    );
                }

                const isActive = pathname.startsWith(link.href);
                const Icon = link.icon;
                const isWab = link.href === '/inbox';
                const showBadge = isWab && wabUnread > 0;

                return (
                    <Link
                        key={link.href}
                        href={link.href}
                        className="relative flex flex-col items-center justify-center w-full h-full gap-1 pt-1"
                    >
                        <div className={cn(
                            "relative p-1.5 rounded-full transition-colors flex items-center justify-center",
                            isActive ? "text-primary" : "text-primary/60 hover:text-primary/80"
                        )}>
                            <Icon className="w-5 h-5" />
                            {showBadge && (
                                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-green-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                                    {wabUnread > 99 ? '99+' : wabUnread}
                                </span>
                            )}
                            {isActive && (
                                <motion.div
                                    layoutId="bottom-nav-indicator"
                                    className="absolute inset-0 bg-primary/10 rounded-full w-10 h-10 m-auto -z-10"
                                    initial={false}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                />
                            )}
                        </div>
                        <span className={cn(
                            "text-[10px] font-medium leading-none",
                            isActive ? "text-primary font-bold" : "text-primary/60"
                        )}>
                            {link.label}
                        </span>
                    </Link>
                );
            })}
        </nav>
    );
}
