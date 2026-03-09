'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { alterarLojaUsuario, toggleAtivoUsuario } from './actions';
import { User, MapPin, Shield } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import * as motion from 'framer-motion/client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Usuario {
    id: string;
    nome: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR';
    lojaAutorizada: 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS';
    ativo: boolean;
}

interface UsuariosContentProps {
    usuarios: Usuario[];
}

// ─── Labels ─────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    OPERADOR: 'Operador',
};

const LOJA_LABELS: Record<string, string> = {
    JOAO_PESSOA: 'João Pessoa',
    SANTA_RITA: 'Santa Rita',
    AMBAS: 'Ambas',
};

const LOJA_OPTIONS: { value: string; label: string }[] = [
    { value: 'JOAO_PESSOA', label: 'João Pessoa' },
    { value: 'SANTA_RITA', label: 'Santa Rita' },
    { value: 'AMBAS', label: 'Ambas' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function UsuariosContent({ usuarios }: UsuariosContentProps) {
    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {usuarios.map((usuario, index) => (
                <motion.div
                    key={usuario.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                >
                    <UsuarioCard usuario={usuario} />
                </motion.div>
            ))}
        </div>
    );
}

// ─── Card ───────────────────────────────────────────────────────────────────

function UsuarioCard({ usuario }: { usuario: Usuario }) {
    const [isPending, startTransition] = useTransition();

    const handleLojaChange = (newLoja: string) => {
        const formData = new FormData();
        formData.set('userId', usuario.id);
        formData.set('lojaAutorizada', newLoja);

        startTransition(async () => {
            const result = await alterarLojaUsuario(formData);
            if (result.success) {
                toast.success(`Loja de ${usuario.nome} alterada para ${LOJA_LABELS[newLoja]}.`);
            } else {
                toast.error(result.error);
            }
        });
    };

    const handleAtivoToggle = (checked: boolean) => {
        const formData = new FormData();
        formData.set('userId', usuario.id);
        formData.set('ativo', String(checked));

        startTransition(async () => {
            const result = await toggleAtivoUsuario(formData);
            if (result.success) {
                toast.success(`${usuario.nome} ${checked ? 'ativado' : 'desativado'}.`);
            } else {
                toast.error(result.error);
            }
        });
    };

    const isSuperAdmin = usuario.role === 'SUPER_ADMIN';

    return (
        <div className={cn(
            "bg-card rounded-xl border p-4 space-y-3 transition-opacity",
            isPending && "opacity-60 pointer-events-none",
            !usuario.ativo && "opacity-60"
        )}>
            {/* Header: Avatar + Nome + Role */}
            <div className="flex items-center gap-3">
                <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center",
                    usuario.ativo ? "bg-primary/10" : "bg-muted"
                )}>
                    <User className={cn(
                        "w-5 h-5",
                        usuario.ativo ? "text-primary" : "text-muted-foreground"
                    )} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{usuario.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">{usuario.email}</p>
                </div>
                <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    usuario.role === 'SUPER_ADMIN' && "bg-amber-100 text-amber-800",
                    usuario.role === 'ADMIN' && "bg-primary/10 text-primary",
                    usuario.role === 'OPERADOR' && "bg-muted text-muted-foreground"
                )}>
                    <Shield className="w-3 h-3 inline-block mr-1" />
                    {ROLE_LABELS[usuario.role]}
                </span>
            </div>

            {/* Loja Selector */}
            <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex gap-1 flex-1">
                    {LOJA_OPTIONS.map((opt) => (
                        <button
                            key={opt.value}
                            onClick={() => handleLojaChange(opt.value)}
                            disabled={isPending || usuario.lojaAutorizada === opt.value}
                            className={cn(
                                "flex-1 text-xs py-1.5 rounded-lg border transition-colors",
                                usuario.lojaAutorizada === opt.value
                                    ? "bg-primary text-primary-foreground border-primary font-medium"
                                    : "bg-card hover:bg-accent/10 text-muted-foreground border-border",
                                isPending && "cursor-not-allowed"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Ativo Toggle */}
            <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-sm text-muted-foreground">
                    {usuario.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <Switch
                    checked={usuario.ativo}
                    onCheckedChange={handleAtivoToggle}
                    disabled={isPending || isSuperAdmin}
                />
            </div>
            {isSuperAdmin && (
                <p className="text-xs text-muted-foreground italic">
                    Super Admins não podem ser desativados.
                </p>
            )}
        </div>
    );
}
