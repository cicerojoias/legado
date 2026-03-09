import { prisma } from '@/lib/prisma';
import { LogsPagination } from './logs-pagination';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

const ACAO_LABELS: Record<string, string> = {
    LANCAMENTO_CRIADO: 'Lançamento criado',
    LANCAMENTO_EDITADO: 'Lançamento editado',
    LANCAMENTO_DELETADO: 'Lançamento deletado',
    CUSTO_FIXO_CRIADO: 'Custo fixo criado',
    CUSTO_FIXO_EDITADO: 'Custo fixo editado',
    CUSTO_FIXO_DELETADO: 'Custo fixo deletado',
    PIN_ALTERADO: 'PIN alterado',
    SENHA_ALTERADA: 'Senha alterada',
    SESSAO_ENCERRADA: 'Sessão encerrada',
    NOTIFICACOES_ATUALIZADAS: 'Notificações atualizadas',
    USUARIO_LOJA_ALTERADA: 'Loja do usuário alterada',
    USUARIO_ATIVADO: 'Usuário ativado',
    USUARIO_DESATIVADO: 'Usuário desativado',
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface LogsContentProps {
    usuario: string;
    acao: string;
    page: number;
}

// ─── Component ──────────────────────────────────────────────────────────────

export async function LogsContent({ usuario, acao, page }: LogsContentProps) {
    const where: Record<string, unknown> = {};

    if (usuario) where.usuario_id = usuario;
    if (acao) where.acao = acao;

    const [logs, total] = await Promise.all([
        prisma.log.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip: (page - 1) * PAGE_SIZE,
            take: PAGE_SIZE,
            include: {
                usuario: { select: { nome: true } },
            },
        }),
        prisma.log.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    if (logs.length === 0) {
        return (
            <div className="text-center py-16 text-muted-foreground text-sm">
                Nenhum log encontrado com esses filtros.
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground px-1">
                {total} registro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
            </p>

            <div className="space-y-2">
                {logs.map((log) => (
                    <div
                        key={log.id}
                        className="bg-card rounded-xl border p-3 space-y-1"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {ACAO_LABELS[log.acao] ?? log.acao}
                            </span>
                            <time
                                className="text-[11px] text-muted-foreground tabular-nums shrink-0"
                                suppressHydrationWarning
                            >
                                {log.created_at.toLocaleDateString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </time>
                        </div>

                        <p className="text-sm text-muted-foreground">
                            {log.usuario?.nome ?? 'Sistema'}
                        </p>

                        {log.detalhe && (
                            <p className="text-xs text-muted-foreground/70 break-all line-clamp-2">
                                {log.detalhe}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            {totalPages > 1 && (
                <LogsPagination currentPage={page} totalPages={totalPages} />
            )}
        </div>
    );
}
