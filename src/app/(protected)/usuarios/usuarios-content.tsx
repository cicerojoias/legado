'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { editUserAction, deleteUserAction, criarUsuarioAction, vincularUsuarioAuthAction } from './actions';
import { User, Shield, MapPin, Pencil, Trash2, AlertTriangle, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as motion from 'framer-motion/client';

import { Input } from '@/components/ui/input';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

// ─── Component ──────────────────────────────────────────────────────────────

export function UsuariosContent({ usuarios }: UsuariosContentProps) {
    const [isCriarOpen, setIsCriarOpen] = useState(false);

    return (
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <Button
                onClick={() => setIsCriarOpen(true)}
                className="w-full flex items-center gap-2"
                variant="outline"
            >
                <UserPlus className="w-4 h-4" />
                Novo Usuário
            </Button>

            {usuarios.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                    <User className="w-12 h-12 mb-3 opacity-20" />
                    <p>Nenhum usuário ativo encontrado.</p>
                </div>
            ) : (
                usuarios.map((usuario, index) => (
                    <motion.div
                        key={usuario.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <UsuarioCard usuario={usuario} />
                    </motion.div>
                ))
            )}

            <CriarUsuarioModal isOpen={isCriarOpen} setIsOpen={setIsCriarOpen} />
        </div>
    );
}

// ─── Card ───────────────────────────────────────────────────────────────────

function UsuarioCard({ usuario }: { usuario: Usuario }) {
    const isSuperAdmin = usuario.role === 'SUPER_ADMIN';
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    return (
        <>
            <div className={cn(
                "bg-card rounded-xl border p-4 transition-opacity",
                !usuario.ativo && "opacity-60 grayscale-[0.3]"
            )}>
                {/* Header: Avatar + Nome + Role + Ações */}
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
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
                            <div className="flex items-center gap-2 mt-1">
                                <span className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1",
                                    usuario.role === 'SUPER_ADMIN' && "bg-amber-100 text-amber-800",
                                    usuario.role === 'ADMIN' && "bg-primary/10 text-primary",
                                    usuario.role === 'OPERADOR' && "bg-muted text-muted-foreground"
                                )}>
                                    <Shield className="w-3 h-3" />
                                    {ROLE_LABELS[usuario.role]}
                                </span>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-secondary text-secondary-foreground flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {LOJA_LABELS[usuario.lojaAutorizada]}
                                </span>
                                {!usuario.ativo && (
                                     <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-red-100/50 text-red-600 border border-red-200">
                                        Inativo
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-primary"
                            onClick={() => setIsEditModalOpen(true)}
                        >
                            <Pencil className="w-4 h-4" />
                            <span className="sr-only">Editar</span>
                        </Button>
                        {!isSuperAdmin && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-500 hover:bg-red-50"
                                onClick={() => setIsDeleteModalOpen(true)}
                            >
                                <Trash2 className="w-4 h-4" />
                                <span className="sr-only">Excluir</span>
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <EditUserModal 
                usuario={usuario} 
                isOpen={isEditModalOpen} 
                setIsOpen={setIsEditModalOpen} 
            />
            {!isSuperAdmin && (
                <DeleteUserModal 
                    usuario={usuario} 
                    isOpen={isDeleteModalOpen} 
                    setIsOpen={setIsDeleteModalOpen} 
                />
            )}
        </>
    );
}

// ─── Modal de Edição (EditUserModal) ────────────────────────────────────────

function EditUserModal({ 
    usuario, 
    isOpen, 
    setIsOpen 
}: { 
    usuario: Usuario; 
    isOpen: boolean; 
    setIsOpen: (o: boolean) => void 
}) {
    const [isPending, startTransition] = useTransition();
    const isSuperAdmin = usuario.role === 'SUPER_ADMIN';

    // Estado local para form (uncontrolled form pattern com FormData)
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        // Garante envio do estado do switch se não estiver no FormData nativo em HTML
        formData.set('userId', usuario.id);
        
        startTransition(async () => {
            const result = await editUserAction(formData);
            if (result.success) {
                toast.success('Usuário atualizado com sucesso.');
                setIsOpen(false);
            } else {
                toast.error(result.error || 'Erro ao atualizar.');
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isPending && setIsOpen(open)}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Editar Usuário</DialogTitle>
                        <DialogDescription>
                            Altere a localização e o status de acesso de <strong>{usuario.nome}</strong>.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6 py-6">
                        <div className="space-y-3">
                            <Label htmlFor="lojaAutorizada">Loja Autorizada</Label>
                            <Select name="lojaAutorizada" defaultValue={usuario.lojaAutorizada} disabled={isPending}>
                                <SelectTrigger id="lojaAutorizada" className="w-full">
                                    <SelectValue placeholder="Selecione a loja..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="JOAO_PESSOA">João Pessoa</SelectItem>
                                    <SelectItem value="SANTA_RITA">Santa Rita</SelectItem>
                                    <SelectItem value="AMBAS">Ambas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="role">Nível de Acesso (Role)</Label>
                            <Select name="role" defaultValue={usuario.role} disabled={isPending || isSuperAdmin}>
                                <SelectTrigger id="role" className="w-full">
                                    <SelectValue placeholder="Selecione a role..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="OPERADOR">Operador</SelectItem>
                                </SelectContent>
                            </Select>
                            {isSuperAdmin && (
                                <p className="text-xs text-muted-foreground">
                                    Super Admin não pode ter a role alterada.
                                </p>
                            )}
                        </div>

                        <div className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <Label className="text-base">Acesso ao Sistema</Label>
                                <p className="text-xs text-muted-foreground text-balance">
                                    {isSuperAdmin 
                                        ? "Super Admins não podem ser desativados." 
                                        : "Desativar revogará imediatamente o acesso desta conta."}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {/* Campos Hidden p/ FormData submeter o Switch/Boolean facilmente */}
                                <input type="hidden" name="ativo" id="ativoInput" value={usuario.ativo ? 'true' : 'false'} />
                                <Switch 
                                    disabled={isPending || isSuperAdmin}
                                    defaultChecked={usuario.ativo}
                                    onCheckedChange={(checked) => {
                                        const el = document.getElementById('ativoInput') as HTMLInputElement;
                                        if (el) el.value = checked ? 'true' : 'false';
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button 
                            type="button" 
                            variant="outline" 
                            onClick={() => setIsOpen(false)}
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Modal de Criação (CriarUsuarioModal) ───────────────────────────────────

function CriarUsuarioModal({
    isOpen,
    setIsOpen,
}: {
    isOpen: boolean;
    setIsOpen: (o: boolean) => void;
}) {
    const [isPending, startTransition] = useTransition();
    const [modo, setModo] = useState<'novo' | 'vincular'>('novo');

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const action = modo === 'novo' ? criarUsuarioAction : vincularUsuarioAuthAction;

        startTransition(async () => {
            const result = await action(formData);
            if (result.success) {
                toast.success(modo === 'novo' ? 'Usuário criado com sucesso.' : 'Usuário vinculado com sucesso.');
                setIsOpen(false);
            } else {
                toast.error(result.error || 'Erro ao processar.');
            }
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!isPending) { setIsOpen(open); if (!open) setModo('novo'); } }}>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Novo Usuário</DialogTitle>
                        <DialogDescription>
                            {modo === 'novo'
                                ? 'Cria conta no Auth e no banco automaticamente.'
                                : 'Vincula uma conta já existente no Auth ao banco de dados.'}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Toggle de modo */}
                    <div className="flex rounded-lg border overflow-hidden mt-4">
                        <button
                            type="button"
                            onClick={() => setModo('novo')}
                            className={cn(
                                'flex-1 py-2 text-sm font-medium transition-colors',
                                modo === 'novo' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                            )}
                        >
                            Criar novo
                        </button>
                        <button
                            type="button"
                            onClick={() => setModo('vincular')}
                            className={cn(
                                'flex-1 py-2 text-sm font-medium transition-colors',
                                modo === 'vincular' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                            )}
                        >
                            Já existe no Auth
                        </button>
                    </div>

                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="nome">Nome</Label>
                            <Input id="nome" name="nome" placeholder="Ex: Jordson" required disabled={isPending} />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email">E-mail</Label>
                            <Input id="email" name="email" type="email" placeholder="email@gmail.com" required disabled={isPending} />
                        </div>

                        {modo === 'novo' && (
                            <div className="space-y-1.5">
                                <Label htmlFor="senha">Senha inicial</Label>
                                <Input id="senha" name="senha" type="password" placeholder="Mínimo 8 caracteres" required disabled={isPending} />
                                <p className="text-xs text-muted-foreground">O usuário poderá alterar a senha pelo perfil.</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <Label htmlFor="role">Nível de Acesso</Label>
                            <Select name="role" defaultValue="OPERADOR" disabled={isPending}>
                                <SelectTrigger id="role" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ADMIN">Admin</SelectItem>
                                    <SelectItem value="OPERADOR">Operador</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="lojaAutorizada">Loja</Label>
                            <Select name="lojaAutorizada" defaultValue="JOAO_PESSOA" disabled={isPending}>
                                <SelectTrigger id="lojaAutorizada" className="w-full">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="JOAO_PESSOA">João Pessoa</SelectItem>
                                    <SelectItem value="SANTA_RITA">Santa Rita</SelectItem>
                                    <SelectItem value="AMBAS">Ambas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={isPending}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? 'Processando...' : modo === 'novo' ? 'Criar Usuário' : 'Vincular Usuário'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ─── Modal de Exclusão (DeleteUserModal) ────────────────────────────────────

function DeleteUserModal({ 
    usuario, 
    isOpen, 
    setIsOpen 
}: { 
    usuario: Usuario; 
    isOpen: boolean; 
    setIsOpen: (o: boolean) => void 
}) {
    const [isPending, startTransition] = useTransition();

    const handleDelete = () => {
        const formData = new FormData();
        formData.set('userId', usuario.id);

        startTransition(async () => {
            const result = await deleteUserAction(formData);
            if (result.success) {
                toast.success('Usuário removido com sucesso.');
                setIsOpen(false);
            } else {
                toast.error(result.error || 'Erro ao excluir usuário.');
                setIsOpen(false);
            }
        });
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={(open) => !isPending && setIsOpen(open)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                        <AlertTriangle className="w-5 h-5" />
                        Excluir Usuário?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-2 mt-2">
                            <p>
                                Você está prestes a excluir o acesso de <strong>{usuario.nome}</strong> ({usuario.email}).
                            </p>
                            <p>
                                Esta ação removerá a conta do provedor de autenticação.
                                Se o histórico financeiro impedir a deleção total, a conta será apenas desativada permanentemente (Soft Delete).
                            </p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
                    <Button 
                        variant="destructive" 
                        onClick={handleDelete}
                        disabled={isPending}
                    >
                        {isPending ? 'Excluindo...' : 'Sim, Excluir Usuário'}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
