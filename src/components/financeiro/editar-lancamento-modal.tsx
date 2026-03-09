'use client';

import { useEffect, useTransition, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { TipoLancamento } from '@prisma/client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { editarLancamento, deletarLancamento } from '@/app/(protected)/hoje/actions';

const JANELA_24H_MS = 24 * 60 * 60 * 1000;
// TON (maquininha) só aparece em ENTRADA — saídas são pagas em PIX ou Dinheiro
const METODOS_ENTRADA = ['PIX', 'TON', 'ESPECIE'];
const METODOS_SAIDA   = ['PIX', 'ESPECIE'];

const editarSchema = z.object({
    id: z.string().uuid(),
    tipo: z.enum(['ENTRADA', 'SAIDA']),
    valor: z.string().min(1, 'Valor obrigatório'),
    descricao: z.string().max(200).optional(),
    metodo_pgto: z.string().optional(),
});

type EditarFormValues = z.infer<typeof editarSchema>;

export interface LancamentoParaEditar {
    id: string;
    tipo: TipoLancamento;
    valor: number;
    descricao: string | null;
    metodo_pgto: string | null;
    created_at: Date;
    usuario_id: string;
}

const ERROR_MESSAGES: Record<string, string> = {
    NAO_AUTORIZADO: 'Sem permissão para esta operação.',
    JANELA_EXPIRADA: 'Prazo de 24h encerrado. Não é possível editar.',
    CAMPOS_INVALIDOS: 'Verifique os campos e tente novamente.',
    CONFLITO_CONCORRENTE: 'Conflito detectado. Tente novamente em instantes.',
    USUARIO_INATIVO: 'Sua conta está inativa.',
    RATE_LIMIT: 'Muitas tentativas. Aguarde um momento.',
    ERRO_INTERNO: 'Erro interno. Tente novamente.',
};

interface EditarLancamentoModalProps {
    lancamento: LancamentoParaEditar | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentUserId: string;
}

export function EditarLancamentoModal({
    lancamento,
    open,
    onOpenChange,
    currentUserId,
}: EditarLancamentoModalProps) {
    const [isPendingDelete, startDeleteTransition] = useTransition();
    const [inlineError, setInlineError] = useState<string | null>(null);

    const isEditavel = lancamento
        ? lancamento.usuario_id === currentUserId &&
          Date.now() - new Date(lancamento.created_at).getTime() < JANELA_24H_MS
        : false;

    const form = useForm<EditarFormValues>({
        resolver: zodResolver(editarSchema),
        defaultValues: { id: '', tipo: 'ENTRADA', valor: '', descricao: '', metodo_pgto: 'PIX' },
    });

    // Pré-popula o form sempre que um lancamento diferente é aberto.
    // Se a saída tinha TON cadastrado (legado), normaliza para PIX.
    useEffect(() => {
        if (lancamento) {
            const metodoSalvo = lancamento.metodo_pgto ?? 'PIX';
            const metodoNormalizado =
                lancamento.tipo === 'SAIDA' && metodoSalvo === 'TON' ? 'PIX' : metodoSalvo;
            form.reset({
                id: lancamento.id,
                tipo: lancamento.tipo,
                valor: String(lancamento.valor),
                descricao: lancamento.descricao ?? '',
                metodo_pgto: metodoNormalizado,
            });
            setInlineError(null);
        }
    }, [lancamento, form]);

    const onSubmit = async (values: EditarFormValues) => {
        setInlineError(null);
        const formData = new FormData();
        formData.append('id', values.id);
        formData.append('tipo', values.tipo);
        formData.append('valor', values.valor);
        if (values.descricao) formData.append('descricao', values.descricao);
        if (values.metodo_pgto) formData.append('metodo_pgto', values.metodo_pgto);

        const result = await editarLancamento(formData);
        if (result.success) {
            toast.success('Lançamento atualizado!');
            onOpenChange(false);
        } else {
            setInlineError(ERROR_MESSAGES[result.code] ?? 'Erro desconhecido.');
        }
    };

    const handleDelete = () => {
        if (!lancamento) return;
        startDeleteTransition(async () => {
            const result = await deletarLancamento(lancamento.id);
            if (result.success) {
                toast.success('Lançamento excluído.');
                onOpenChange(false);
            } else {
                setInlineError(ERROR_MESSAGES[result.code] ?? 'Erro ao excluir.');
            }
        });
    };

    const isEntrada = form.watch('tipo') === 'ENTRADA';
    const metodosDisponiveis = isEntrada ? METODOS_ENTRADA : METODOS_SAIDA;
    const isPendingEdit = form.formState.isSubmitting;
    const isAnyPending = isPendingEdit || isPendingDelete;

    if (!lancamento) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh]">
                <div className="mx-auto w-full p-4 overflow-y-auto">
                    <DialogHeader className="px-0 text-left">
                        <DialogTitle>Editar Lançamento</DialogTitle>
                        <DialogDescription>
                            {isEditavel
                                ? 'Altere os dados da transação.'
                                : 'Prazo de edição encerrado ou lançamento de outro usuário.'}
                        </DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
                            <input type="hidden" {...form.register('id')} />

                            {/* Toggle Tipo */}
                            <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 rounded-xl">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={!isEditavel || isAnyPending}
                                    className={`rounded-lg ${isEntrada ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white' : 'text-muted-foreground'}`}
                                    onClick={() => form.setValue('tipo', 'ENTRADA')}
                                >
                                    Entrada
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    disabled={!isEditavel || isAnyPending}
                                    className={`rounded-lg ${!isEntrada ? 'bg-rose-500 text-white hover:bg-rose-600 hover:text-white' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                        form.setValue('tipo', 'SAIDA');
                                        if (form.getValues('metodo_pgto') === 'TON') {
                                            form.setValue('metodo_pgto', 'PIX');
                                        }
                                    }}
                                >
                                    Saída
                                </Button>
                            </div>

                            <FormField
                                control={form.control}
                                name="valor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor (R$)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                inputMode="decimal"
                                                placeholder="0.00"
                                                disabled={!isEditavel || isAnyPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="descricao"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Descrição</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Venda de aliança, conserto..."
                                                disabled={!isEditavel || isAnyPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="metodo_pgto"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Pagamento</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            value={field.value}
                                            disabled={!isEditavel || isAnyPending}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {metodosDisponiveis.map((m) => (
                                                    <SelectItem key={m} value={m}>{m}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Erro inline */}
                            {inlineError && (
                                <p className="text-sm text-rose-500 font-medium">{inlineError}</p>
                            )}

                            {/* Botões de ação */}
                            <div className="flex gap-3 mt-6">
                                {isEditavel && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={isAnyPending}
                                                className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 min-w-[44px] min-h-[44px]"
                                                aria-label="Excluir lançamento"
                                            >
                                                {isPendingDelete ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Excluir lançamento?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Esta ação não pode ser desfeita.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={handleDelete}
                                                    className="bg-rose-500 hover:bg-rose-600 text-white"
                                                >
                                                    Excluir
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}

                                <Button
                                    type="submit"
                                    disabled={!isEditavel || isAnyPending}
                                    className="flex-1 py-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 transition-all"
                                >
                                    {isPendingEdit ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        'Salvar Alterações'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
