'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, PieChart, Settings, LogOut, FileText, LayoutDashboard, Wrench, Users, ScrollText, Sparkles } from 'lucide-react';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { usePermissions } from '@/hooks/use-permissions';
import { useWabUnreadTotal } from '@/hooks/use-wab-unread-total';
import { cn } from '@/lib/utils';
import { logoutAction } from '@/app/(auth)/logout/actions';

export function Sidebar() {
    const pathname = usePathname();
    const { isAdmin, isSuperAdmin, isLoading } = usePermissions();
    const wabUnread = useWabUnreadTotal();

    const handleLogout = async () => {
        await logoutAction();
    };

    const isSandbox = pathname === '/sandbox';

    return (
        <aside className={cn(
            "w-64 bg-card flex flex-col h-full",
            !isSandbox && "border-r"
        )}>
            <div className="p-6">
                <h2 className="text-xl font-semibold tracking-tight">Cícero Joias</h2>
            </div>

            <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                <Link
                    href="/hoje"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        pathname === '/hoje' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                    )}
                >
                    <Home className="w-4 h-4" />
                    Hoje
                </Link>

                {/* Admin routes */}
                {!isLoading && isAdmin && (
                    <>
                        <Link
                            href="/lancamentos"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                pathname === '/lancamentos' ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                            )}
                        >
                            <FileText className="w-4 h-4" />
                            Lançamentos
                        </Link>

                        <div className="pt-4 pb-1">
                            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Gestão</p>
                        </div>
                        {isSuperAdmin && (
                            <Link
                                href="/dashboard"
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                    pathname.startsWith('/dashboard') ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                                )}
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                Dashboard
                            </Link>
                        )}
                        <Link
                            href="/relatorios"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                pathname.startsWith('/relatorios') ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                            )}
                        >
                            <PieChart className="w-4 h-4" />
                            Relatórios
                        </Link>
                        {isSuperAdmin && (
                            <Link
                                href="/custos-fixos"
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                    pathname.startsWith('/custos-fixos') ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                                )}
                            >
                                <Wrench className="w-4 h-4" />
                                Custos Fixos
                            </Link>
                        )}
                        {isSuperAdmin && (
                            <>
                                <div className="pt-4 pb-1">
                                    <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Administração</p>
                                </div>
                                <Link
                                    href="/usuarios"
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                        pathname.startsWith('/usuarios') ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                                    )}
                                >
                                    <Users className="w-4 h-4" />
                                    Usuários
                                </Link>
                                <Link
                                    href="/logs"
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                        pathname.startsWith('/logs') ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                                    )}
                                >
                                    <ScrollText className="w-4 h-4" />
                                    Logs
                                </Link>
                            </>
                        )}
                    </>
                )}

                {/* Comunicação — visível para admin */}
                {!isLoading && isAdmin && (
                    <>
                        <div className="pt-4 pb-1">
                            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comunicação</p>
                        </div>
                        <Link
                            href="/inbox"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                pathname.startsWith('/inbox') ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                            )}
                        >
                            <WhatsAppIcon className="w-4 h-4" />
                            WAB
                            {wabUnread > 0 && (
                                <span className="ml-auto min-w-[20px] h-5 bg-green-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center px-1.5 leading-none">
                                    {wabUnread > 99 ? '99+' : wabUnread}
                                </span>
                            )}
                        </Link>
                        <Link
                            href="/assistente"
                            className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                                pathname.startsWith('/assistente') ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                            )}
                        >
                            <Sparkles className="w-4 h-4" />
                            Assistente IA
                        </Link>
                    </>
                )}

                {/* Configurações — visível para TODOS os roles (QA R4) */}
                <Link
                    href="/perfil"
                    className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        pathname.startsWith('/perfil') ? "bg-primary text-primary-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground text-muted-foreground"
                    )}
                >
                    <Settings className="w-4 h-4" />
                    Configurações
                </Link>
            </nav>

            <div className={cn(
                "p-4",
                !isSandbox && "border-t"
            )}>
                <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 px-3 py-2 text-sm text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-destructive/10"
                >
                    <LogOut className="w-4 h-4" />
                    Sair
                </button>
            </div>
        </aside>
    );
}
