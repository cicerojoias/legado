'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import {
    trocarPinAction,
    alterarSenhaAction,
    encerrarSessaoAction,
    atualizarNotificacoesAction,
    atualizarLojaPadraoAction,
} from './actions';
import {
    KeyRound,
    LogOut,
    Lock,
    Bell,
    BellRing,
    Info,
    ChevronRight,
    User,
    Store,
} from 'lucide-react';
import { usePushSubscription } from '@/hooks/use-push-subscription';
import * as motion from 'framer-motion/client';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PerfilContentProps {
    nome: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERADOR';
    lojaAutorizada: 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS';
    lojaPadrao: 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS' | null;
    notifPush: boolean;
    notifHorario: string;
}

type OpenSection = 'pin' | 'senha' | 'notificacoes' | 'lojaPadrao' | null;

// ─── Role labels ────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Administrador',
    OPERADOR: 'Operador',
};

// ─── Changelog resumido (SUPER_ADMIN) ───────────────────────────────────────

const CHANGELOG_RESUMIDO = [
    { versao: '0.14.2', data: '31/03/2026', resumo: 'WAB: reagir em modo seleção — barra flutuante de emojis estilo WhatsApp (aparece com 1 msg selecionada); botão Smile oculto no mobile' },
    { versao: '0.14.1', data: '31/03/2026', resumo: 'WAB: fix encaminhar — botão visível (z-index acima do BottomNav); fix reações — Smile visível no mobile e fecha ao entrar no modo seleção' },
    { versao: '0.14.0', data: '31/03/2026', resumo: 'WAB: encaminhar mensagens — selecionar → ↗ → bottom sheet estilo WhatsApp com busca, multi-conversa e indicador "Encaminhada" na bolha' },
    { versao: '0.13.2', data: '31/03/2026', resumo: 'WAB: fix overscroll — listener nativo non-passive no container do input impede drag na área de padding scrollar a página' },
    { versao: '0.13.1', data: '31/03/2026', resumo: 'WAB: fix seleção — sem borda cinza em msgs recebidas, "Cícero Joias" no copy, imagem+legenda copiados; Perfil: changelog limitado a 3 entradas' },
    { versao: '0.13.0', data: '31/03/2026', resumo: 'WAB: selecionar mensagens — long press seleciona, copiar e deletar (janela 60h) com feedback granular' },
    { versao: '0.12.9', data: '31/03/2026', resumo: 'WAB: fix ícone de reply duplicado no mobile — swipe centralizado' },
    { versao: '0.12.7', data: '31/03/2026', resumo: 'WAB: reações às mensagens — segurar para reagir com ✅💚🤝🙏' },
    { versao: '0.12.6', data: '31/03/2026', resumo: 'WAB: fix horário das mensagens — fuso America/Recife em lista e chat' },
    { versao: '0.12.5', data: '31/03/2026', resumo: 'WAB: fix espaço abaixo do input e header sumindo ao scrollar' },
    { versao: '0.12.4', data: '31/03/2026', resumo: 'WAB: fix layout mobile — header e input sempre fixos, scroll só nas mensagens' },
    { versao: '0.12.3', data: '31/03/2026', resumo: 'WAB: fix scroll horizontal durante swipe-to-reply' },
    { versao: '0.12.2', data: '31/03/2026', resumo: 'WAB: swipe para direita ativa reply (igual WhatsApp)' },
    { versao: '0.12.1', data: '31/03/2026', resumo: 'WAB: fix reply — citação aparece corretamente no WhatsApp do cliente' },
    { versao: '0.12.0', data: '31/03/2026', resumo: 'WAB: scroll inteligente com botão flutuante de novas mensagens' },
    { versao: '0.11.0', data: '31/03/2026', resumo: 'WAB: Realtime, não lidas, infinite scroll, reply e busca' },
    { versao: '0.10.0', data: '31/03/2026', resumo: 'WAB: push notifications nativas via Web Push / VAPID' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function PerfilContent({ 
    nome, 
    email, 
    role, 
    lojaAutorizada,
    lojaPadrao,
    notifPush, 
    notifHorario 
}: PerfilContentProps) {
    const [openSection, setOpenSection] = useState<OpenSection>(null);
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    const isSuperAdmin = role === 'SUPER_ADMIN';

    const toggleSection = (section: OpenSection) => {
        setOpenSection((prev) => (prev === section ? null : section));
    };

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-lg font-semibold">Configurações</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                    Gerencie sua conta e preferências
                </p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Perfil info card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card rounded-xl p-4 border"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{nome}</p>
                            <p className="text-sm text-muted-foreground truncate">{email}</p>
                            <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
                                {ROLE_LABELS[role] ?? role}
                            </span>
                        </div>
                    </div>
                </motion.div>

                {/* Segurança */}
                <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 pb-1">
                        Segurança
                    </p>

                    {/* Trocar PIN */}
                    <SectionButton
                        icon={<KeyRound className="w-4 h-4" />}
                        label="Trocar PIN"
                        isOpen={openSection === 'pin'}
                        onClick={() => toggleSection('pin')}
                    />
                    {openSection === 'pin' && <TrocarPinForm />}

                    {/* Alterar Senha */}
                    <SectionButton
                        icon={<Lock className="w-4 h-4" />}
                        label="Alterar senha"
                        isOpen={openSection === 'senha'}
                        onClick={() => toggleSection('senha')}
                    />
                    {openSection === 'senha' && <AlterarSenhaForm />}

                    {/* Encerrar sessão */}
                    <EncerrarSessaoButton />
                </div>

                {/* Notificações — ADMIN+ */}
                {isAdmin && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 pb-1">
                            Notificações
                        </p>

                        {/* Toggle WAB push — inline, sem expansão */}
                        <WabNotificacoesToggle />

                        <SectionButton
                            icon={<Bell className="w-4 h-4" />}
                            label="Resumo diário (financeiro)"
                            isOpen={openSection === 'notificacoes'}
                            onClick={() => toggleSection('notificacoes')}
                        />
                        {openSection === 'notificacoes' && (
                            <NotificacoesForm
                                initialPush={notifPush}
                                initialHorario={notifHorario}
                            />
                        )}
                    </div>
                )}

                {/* Preferência de Loja Global - AMBAS */}
                {lojaAutorizada === 'AMBAS' && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 pb-1">
                            Preferências
                        </p>
                        <SectionButton
                            icon={<Store className="w-4 h-4" />}
                            label="Loja Padrão"
                            isOpen={openSection === 'lojaPadrao'}
                            onClick={() => toggleSection('lojaPadrao')}
                        />
                        {openSection === 'lojaPadrao' && (
                            <AtualizarLojaPadraoForm
                                initialLoja={lojaPadrao}
                            />
                        )}
                    </div>
                )}

                {/* Sistema — SUPER_ADMIN */}
                {isSuperAdmin && (
                    <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 pb-1">
                            Sistema
                        </p>
                        <div className="bg-card rounded-xl border p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Versão</span>
                                <span className="text-sm font-medium">0.14.2</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Ambiente</span>
                                <span className="text-sm font-medium">
                                    {process.env.NODE_ENV === 'production' ? 'Produção' : 'Desenvolvimento'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-card rounded-xl border p-4 space-y-3">
                            <p className="text-sm font-medium flex items-center gap-2">
                                <Info className="w-4 h-4 text-muted-foreground" />
                                Últimas atualizações
                            </p>
                            {CHANGELOG_RESUMIDO.slice(0, 3).map((entry) => (
                                <div key={entry.versao} className="pl-6 border-l-2 border-primary/20">
                                    <p className="text-xs text-muted-foreground">
                                        v{entry.versao} — {entry.data}
                                    </p>
                                    <p className="text-sm">{entry.resumo}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Section Button ─────────────────────────────────────────────────────────

function SectionButton({
    icon,
    label,
    isOpen,
    onClick,
}: {
    icon: React.ReactNode;
    label: string;
    isOpen: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-xl border text-sm hover:bg-accent/10 transition-colors"
        >
            <span className="text-muted-foreground">{icon}</span>
            <span className="flex-1 text-left font-medium">{label}</span>
            <ChevronRight
                className={`w-4 h-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-90' : ''}`}
            />
        </button>
    );
}

// ─── Trocar PIN Form ────────────────────────────────────────────────────────

function TrocarPinForm() {
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const form = e.currentTarget;

        startTransition(async () => {
            const result = await trocarPinAction(formData);
            if (result.success) {
                toast.success('PIN alterado com sucesso!');
                form.reset();
            } else {
                toast.error(result.error);
            }
        });
    };

    return (
        <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-card rounded-xl border p-4 space-y-3"
        >
            <div>
                <label className="text-xs text-muted-foreground">PIN atual</label>
                <Input
                    name="pinAtual"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="••••"
                    required
                    autoComplete="off"
                />
            </div>
            <div>
                <label className="text-xs text-muted-foreground">Novo PIN</label>
                <Input
                    name="novoPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="••••"
                    required
                    autoComplete="off"
                />
            </div>
            <div>
                <label className="text-xs text-muted-foreground">Confirmar novo PIN</label>
                <Input
                    name="confirmarPin"
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    pattern="\d{4}"
                    placeholder="••••"
                    required
                    autoComplete="off"
                />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Alterando...' : 'Alterar PIN'}
            </Button>
        </motion.form>
    );
}

// ─── Alterar Senha Form ─────────────────────────────────────────────────────

function AlterarSenhaForm() {
    const [isPending, startTransition] = useTransition();

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const form = e.currentTarget;

        startTransition(async () => {
            const result = await alterarSenhaAction(formData);
            if (result.success) {
                toast.success('Senha alterada com sucesso!');
                form.reset();
            } else {
                toast.error(result.error);
            }
        });
    };

    return (
        <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit}
            className="bg-card rounded-xl border p-4 space-y-3"
        >
            <div>
                <label className="text-xs text-muted-foreground">Senha atual</label>
                <Input
                    name="senhaAtual"
                    type="password"
                    placeholder="••••••"
                    required
                    minLength={6}
                    autoComplete="current-password"
                />
            </div>
            <div>
                <label className="text-xs text-muted-foreground">Nova senha</label>
                <Input
                    name="novaSenha"
                    type="password"
                    placeholder="••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                />
            </div>
            <div>
                <label className="text-xs text-muted-foreground">Confirmar nova senha</label>
                <Input
                    name="confirmarSenha"
                    type="password"
                    placeholder="••••••"
                    required
                    minLength={6}
                    autoComplete="new-password"
                />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? 'Alterando...' : 'Alterar senha'}
            </Button>
        </motion.form>
    );
}

// ─── Encerrar Sessão Button ─────────────────────────────────────────────────

function EncerrarSessaoButton() {
    const [isPending, startTransition] = useTransition();

    const handleLogout = () => {
        startTransition(async () => {
            await encerrarSessaoAction();
        });
    };

    return (
        <button
            onClick={handleLogout}
            disabled={isPending}
            className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-xl border text-sm hover:bg-destructive/5 transition-colors text-destructive disabled:opacity-50"
        >
            <LogOut className="w-4 h-4" />
            <span className="flex-1 text-left font-medium">
                {isPending ? 'Encerrando...' : 'Encerrar sessão'}
            </span>
        </button>
    );
}

// ─── WAB Notificações Toggle ─────────────────────────────────────────────────

function WabNotificacoesToggle() {
    const { supported, permission, subscribed, isLoading, subscribe, unsubscribe } = usePushSubscription()

    const handleToggle = async (checked: boolean) => {
        if (checked) {
            const ok = await subscribe()
            if (!ok && permission === 'denied') {
                toast.error('Notificações bloqueadas. Habilite nas configurações do navegador.')
            } else if (!ok) {
                toast.error('Não foi possível ativar as notificações.')
            } else {
                toast.success('Notificações WAB ativadas!')
            }
        } else {
            await unsubscribe()
            toast.success('Notificações WAB desativadas.')
        }
    }

    return (
        <div className="bg-card rounded-xl border px-4 py-3">
            <div className="flex items-center gap-3">
                <BellRing className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Mensagens WhatsApp</p>
                    <p className="text-xs text-muted-foreground">
                        {!supported
                            ? 'Instale o app na tela inicial para ativar (iOS)'
                            : permission === 'denied'
                                ? 'Bloqueado — habilite nas configurações do navegador'
                                : subscribed
                                    ? 'Recebendo alertas de novas mensagens'
                                    : 'Ative para receber alertas de novas mensagens'}
                    </p>
                </div>
                <Switch
                    checked={subscribed}
                    onCheckedChange={handleToggle}
                    disabled={isLoading || !supported || permission === 'denied'}
                />
            </div>
        </div>
    )
}

// ─── Notificações Form ──────────────────────────────────────────────────────

function NotificacoesForm({
    initialPush,
    initialHorario,
}: {
    initialPush: boolean;
    initialHorario: string;
}) {
    const [isPending, startTransition] = useTransition();
    const [pushEnabled, setPushEnabled] = useState(initialPush);
    const [horario, setHorario] = useState(initialHorario);

    const handleSave = () => {
        const formData = new FormData();
        formData.set('notif_push', String(pushEnabled));
        formData.set('notif_horario', horario);

        startTransition(async () => {
            const result = await atualizarNotificacoesAction(formData);
            if (result.success) {
                toast.success('Notificações atualizadas!');
            } else {
                toast.error(result.error);
            }
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl border p-4 space-y-4"
        >
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">Resumo diário</p>
                    <p className="text-xs text-muted-foreground">
                        Receba o total do dia por push
                    </p>
                </div>
                <Switch
                    checked={pushEnabled}
                    onCheckedChange={setPushEnabled}
                />
            </div>

            <div>
                <label className="text-xs text-muted-foreground">Horário da notificação</label>
                <Input
                    type="time"
                    value={horario}
                    onChange={(e) => setHorario(e.target.value)}
                    className="mt-1"
                />
            </div>

            <Button
                onClick={handleSave}
                className="w-full"
                disabled={isPending}
            >
                {isPending ? 'Salvando...' : 'Salvar preferências'}
            </Button>
        </motion.div>
    );
}

// ─── Atualizar Loja Padrão Form ─────────────────────────────────────────────

function AtualizarLojaPadraoForm({
    initialLoja,
}: {
    initialLoja: 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS' | null;
}) {
    const [isPending, startTransition] = useTransition();
    const [loja, setLoja] = useState<string>(initialLoja || 'null');

    const handleSave = () => {
        const formData = new FormData();
        formData.set('lojaPadrao', loja);

        startTransition(async () => {
            const result = await atualizarLojaPadraoAction(formData);
            if (result.success) {
                toast.success('Loja padrão de inicialização atualizada!');
            } else {
                toast.error(result.error);
            }
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-card rounded-xl border p-4 space-y-4"
        >
            <div className="space-y-1">
                <p className="text-sm font-medium">Inicialização do Sistema</p>
                <p className="text-xs text-muted-foreground">
                    Ao abrir o sistema, qual loja deve ser carregada primeiro? 
                    (Automático: opta por João Pessoa).
                </p>
            </div>

            <div className="space-y-2">
                <select 
                    title="Selecione a loja padrão" 
                    value={loja} 
                    onChange={(e) => setLoja(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <option value="null">Automático (João Pessoa)</option>
                    <option value="JOAO_PESSOA">João Pessoa (Forçado)</option>
                    <option value="SANTA_RITA">Santa Rita (Forçado)</option>
                </select>
            </div>

            <Button
                onClick={handleSave}
                className="w-full"
                disabled={isPending || loja === String(initialLoja || 'null')}
            >
                {isPending ? 'Salvando...' : 'Definir como Padrão'}
            </Button>
        </motion.div>
    );
}
