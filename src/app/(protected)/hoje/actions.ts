'use server';

import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { Loja, Prisma, TipoLancamento } from '@prisma/client';
import { rateLimit } from '@/lib/rate-limit';
import { DeleteQuerySchema, EditarLancamentoSchema, MetodosPgtoCriacaoEnum } from '@/lib/validations';
import { normalizeMetodoPgto } from '@/lib/financeiro/metodos-pgto';

// ─── Schema interno usado apenas por createLancamento ────────────────────────
const formSchema = z.object({
    tipo: z.enum(['ENTRADA', 'SAIDA']),
    valor: z.string().transform((val) => Number(val.replace(',', '.'))),
    descricao: z.string().min(1, 'A descrição é obrigatória').max(200),
    categoria: z.string().nullable(),
    metodo_pgto: MetodosPgtoCriacaoEnum.nullable(),
    loja: z.string().optional().nullable(),
    observacao: z.string().optional().nullable(),
    data_ref: z.string().optional().nullable(),
});

// ─── Erro semântico tipado para mutations financeiras ────────────────────────
// Evita `throw 'string'` — o TypeScript verifica o campo `code` via union
// literal, tornando o catch type-safe e eliminando bugs de typo.
type MutacaoErrorCode =
    | 'NAO_AUTORIZADO'       // Registro inexistente, já deletado ou de terceiro
    | 'JANELA_EXPIRADA'      // Fora da janela de 24h após a criação (ADR-0002)
    | 'CAMPOS_INVALIDOS'     // Falha na validação Zod
    | 'CONFLITO_CONCORRENTE' // P2034: serialization failure em tx concorrente
    | 'USUARIO_INATIVO'      // dbUser.ativo === false
    | 'RATE_LIMIT'           // Limite de requisições excedido
    | 'ERRO_INTERNO';        // Erro inesperado — logado, não exposto ao client

class MutacaoError extends Error {
    constructor(public readonly code: MutacaoErrorCode) {
        super(code);
        this.name = 'MutacaoError';
    }
}

// Tipo de retorno compartilhado pelas actions de mutação
type MutacaoResult =
    | { success: true }
    | { success: false; code: MutacaoErrorCode; message?: string };

// ─── Constantes ──────────────────────────────────────────────────────────────
const JANELA_24H_MS = 24 * 60 * 60 * 1000;
const MUTACAO_MAX_RPM = 30; // Mutations: limite mais generoso que auth (5/min)

// ─────────────────────────────────────────────────────────────────────────────
// createLancamento (comportamento inalterado)
// ─────────────────────────────────────────────────────────────────────────────
export async function createLancamento(formData: FormData) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return { error: 'Usuário não autenticado' };
        }

        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { lojaAutorizada: true, role: true }
        });

        if (!dbUser) {
            return { error: 'Usuário inválido ou não encontrado no banco' };
        }

        const rawData = {
            tipo: formData.get('tipo') as string,
            valor: formData.get('valor') as string,
            descricao: formData.get('descricao') as string,
            categoria: formData.get('categoria') as string || null,
            metodo_pgto: formData.get('metodo_pgto') as string || null,
            loja: formData.get('loja') as string || null,
            observacao: formData.get('observacao') as string || null,
            data_ref: formData.get('data_ref') as string || null,
        };

        const validatedFields = formSchema.safeParse(rawData);

        if (!validatedFields.success) {
            return { error: 'Campos inválidos' };
        }

        const { tipo, valor, descricao, categoria, metodo_pgto, loja: inputLoja, observacao, data_ref } = validatedFields.data;
        const finalMetodoPgto = normalizeMetodoPgto(metodo_pgto);

        // **SECURITY: Blind injeção de Loja**
        // A action desconfia do Client. Se o usuário tem AMBAS as lojas, aceita o Input (se for JP ou SR).
        // Senão, cega e ignora a input e força a lojaAutorizada pela sessão.
        let finalLoja: Loja;

        if (dbUser.lojaAutorizada === 'AMBAS' && inputLoja && (inputLoja === 'JOAO_PESSOA' || inputLoja === 'SANTA_RITA')) {
            finalLoja = inputLoja as Loja;
        } else if (dbUser.lojaAutorizada === 'AMBAS') {
            // Fallback caso a UI bug
            return { error: 'Selecione uma loja' };
        } else {
            // Force user's actual store. IDOR mitigated.
            finalLoja = dbUser.lojaAutorizada;
        }

        // Determinar a data de referência (da URL/UI ou Hoje)
        const finalDataRef = data_ref ? new Date(data_ref) : new Date();

        // Criar o lançamento
        await prisma.lancamento.create({
            data: {
                usuario_id: user.id,
                tipo: tipo as TipoLancamento,
                valor: valor,
                descricao: `${descricao} ${categoria ? `[${categoria}]` : ''} ${observacao ? `- Obs: ${observacao}` : ''}`.trim(),
                metodo_pgto: finalMetodoPgto,
                loja: finalLoja,
                data_ref: finalDataRef,
            }
        });

        // Registrar o log de auditoria
        await prisma.log.create({
            data: {
                acao: 'LANCAMENTO_CRIADO',
                detalhe: `${tipo} de ${valor} em ${finalLoja}`,
                usuario_id: user.id
            }
        });

        revalidatePath('/hoje');
        return { success: true };

    } catch (error) {
        console.error('Erro ao criar lançamento:', error);
        return { error: 'Erro interno ao processar lançamento.' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// deletarLancamento — Soft-delete atômico com $transaction(Serializable)
//
// Fluxo: Auth → Rate limit → Zod(uuid) → dbUser.ativo → $tx {
//   findUnique → check exist/deleted → check owner → check 24h →
//   update(deletado_at) → log(snapshot)
// } → revalidate
// ─────────────────────────────────────────────────────────────────────────────
export async function deletarLancamento(id: string): Promise<MutacaoResult> {
    try {
        // 1. Auth — getUser() valida o JWT server-side via cookie seguro
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, code: 'NAO_AUTORIZADO' };

        // 2. Rate limit por userId — 30 mutations/min, 15min lockout
        const rl = await rateLimit(`mutacao:${user.id}`, MUTACAO_MAX_RPM);
        if (!rl.success) return { success: false, code: 'RATE_LIMIT', message: rl.message };

        // 3. Validação de formato do ID (UUID v4)
        const parsed = DeleteQuerySchema.safeParse({ id });
        if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' };

        // 4. Verificar se o usuário ainda está ativo no sistema
        //    JWT válido ≠ usuário ativo: admin pode desativar sem invalidar sessões
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { ativo: true },
        });
        if (!dbUser || !dbUser.ativo) return { success: false, code: 'USUARIO_INATIVO' };

        // 5. Transação Serializable — leitura + escrita em bloco atômico
        //    Elimina TOCTOU: nenhuma outra transação pode alterar o registro
        //    entre o findUnique e o update dentro desta janela
        await prisma.$transaction(async (tx) => {
            const lancamento = await tx.lancamento.findUnique({
                where: { id: parsed.data.id },
            });

            // 5a. Registro não existe ou já foi deletado
            //     Resposta unificada com "de terceiro" para evitar enumeração de IDs
            if (!lancamento || lancamento.deletado_at !== null) {
                throw new MutacaoError('NAO_AUTORIZADO');
            }

            // 5b. IDOR: o lançamento pertence a outro usuário
            if (lancamento.usuario_id !== user.id) {
                throw new MutacaoError('NAO_AUTORIZADO');
            }

            // 5c. Janela de 24h — ADR-0002: mesma regra para todos os roles
            if (Date.now() - lancamento.created_at.getTime() > JANELA_24H_MS) {
                throw new MutacaoError('JANELA_EXPIRADA');
            }

            // 5d. Soft-delete — WHERE inclui usuario_id e deletado_at:null como
            //     guard duplo: previne update silencioso em cenário de race condition
            await tx.lancamento.update({
                where: {
                    id: parsed.data.id,
                    usuario_id: user.id,
                    deletado_at: null,
                },
                data: { deletado_at: new Date() },
            });

            // 5e. Audit log com snapshot completo do registro para rastreabilidade
            await tx.log.create({
                data: {
                    acao: 'LANCAMENTO_DELETADO',
                    detalhe: JSON.stringify({
                        id: lancamento.id,
                        tipo: lancamento.tipo,
                        valor: lancamento.valor.toString(),
                        descricao: lancamento.descricao,
                        loja: lancamento.loja,
                        data_ref: lancamento.data_ref,
                        created_at: lancamento.created_at,
                    }),
                    usuario_id: user.id,
                },
            });
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,  // ms aguardando slot de conexão na pool
            timeout: 10000, // ms máximo de duração da transação
        });

        // 6. Invalida o cache de ambas as páginas que exibem lançamentos
        //    'layout' em /lancamentos garante todas as variantes de query-param
        revalidatePath('/hoje');
        revalidatePath('/lancamentos', 'layout');
        return { success: true };

    } catch (error) {
        // Erros semânticos internos da $transaction (MutacaoError propaga para cá)
        if (error instanceof MutacaoError) {
            return { success: false, code: error.code };
        }
        // P2034: conflito de serialização — duas transações Serializable concorrentes
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2034'
        ) {
            return { success: false, code: 'CONFLITO_CONCORRENTE' };
        }
        console.error('[deletarLancamento] Erro inesperado:', error);
        return { success: false, code: 'ERRO_INTERNO' };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// editarLancamento — Edição atômica com $transaction(Serializable)
//
// Campos mutáveis: tipo, valor, descricao, metodo_pgto
// Campos imutáveis: loja, data_ref, usuario_id (não presentes no schema de edição)
// ─────────────────────────────────────────────────────────────────────────────
export async function editarLancamento(formData: FormData): Promise<MutacaoResult> {
    try {
        // 1. Auth
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, code: 'NAO_AUTORIZADO' };

        // 2. Rate limit (mesma chave que deletar — compartilha o bucket de mutations)
        const rl = await rateLimit(`mutacao:${user.id}`, MUTACAO_MAX_RPM);
        if (!rl.success) return { success: false, code: 'RATE_LIMIT', message: rl.message };

        // 3. Validação via EditarLancamentoSchema
        //    metodo_pgto usa z.string() livre (não MetodosPgtoEnum) para suportar
        //    valores legados como "TON" existentes no banco
        const rawData = {
            id:          formData.get('id')          as string,
            tipo:        formData.get('tipo')        as string,
            valor:       formData.get('valor')       as string,
            descricao:   formData.get('descricao')   as string | undefined,
            metodo_pgto: formData.get('metodo_pgto') as string | null,
        };
        const parsed = EditarLancamentoSchema.safeParse(rawData);
        if (!parsed.success) return { success: false, code: 'CAMPOS_INVALIDOS' };
        const finalMetodoPgto = normalizeMetodoPgto(parsed.data.metodo_pgto);

        // 4. Verificar usuário ativo
        const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: { ativo: true },
        });
        if (!dbUser || !dbUser.ativo) return { success: false, code: 'USUARIO_INATIVO' };

        // 5. Transação Serializable
        await prisma.$transaction(async (tx) => {
            const lancamento = await tx.lancamento.findUnique({
                where: { id: parsed.data.id },
            });

            // 5a. Registro não existe ou já deletado
            if (!lancamento || lancamento.deletado_at !== null) {
                throw new MutacaoError('NAO_AUTORIZADO');
            }

            // 5b. IDOR — pertence a outro usuário
            if (lancamento.usuario_id !== user.id) {
                throw new MutacaoError('NAO_AUTORIZADO');
            }

            // 5c. Janela de 24h
            if (Date.now() - lancamento.created_at.getTime() > JANELA_24H_MS) {
                throw new MutacaoError('JANELA_EXPIRADA');
            }

            // 5d. Update — apenas campos validados; loja/data_ref são preservados
            await tx.lancamento.update({
                where: {
                    id: parsed.data.id,
                    usuario_id: user.id,
                    deletado_at: null,
                },
                data: {
                    tipo:        parsed.data.tipo as TipoLancamento,
                    valor:       parseFloat(parsed.data.valor),
                    descricao:   parsed.data.descricao   ?? null,
                    metodo_pgto: finalMetodoPgto,
                },
            });

            // 5e. Audit log com snapshot antes/depois para rastreabilidade completa
            await tx.log.create({
                data: {
                    acao: 'LANCAMENTO_EDITADO',
                    detalhe: JSON.stringify({
                        id: lancamento.id,
                        antes: {
                            tipo:        lancamento.tipo,
                            valor:       lancamento.valor.toString(),
                            descricao:   lancamento.descricao,
                            metodo_pgto: lancamento.metodo_pgto,
                        },
                        depois: {
                            tipo:        parsed.data.tipo,
                            valor:       parsed.data.valor,
                            descricao:   parsed.data.descricao   ?? null,
                            metodo_pgto: finalMetodoPgto,
                        },
                    }),
                    usuario_id: user.id,
                },
            });
        }, {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000,
        });

        revalidatePath('/hoje');
        revalidatePath('/lancamentos', 'layout');
        return { success: true };

    } catch (error) {
        if (error instanceof MutacaoError) {
            return { success: false, code: error.code };
        }
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2034'
        ) {
            return { success: false, code: 'CONFLITO_CONCORRENTE' };
        }
        console.error('[editarLancamento] Erro inesperado:', error);
        return { success: false, code: 'ERRO_INTERNO' };
    }
}
