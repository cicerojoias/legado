'use client';

import { useEffect, useTransition, useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Trash2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
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

// ─── Helpers de formatação BRL (estilo transferência bancária) ───────────────
function formatCurrency(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '0,00';

    const cents = parseInt(digits, 10);
    const reais = (cents / 100).toFixed(2);
    const [intPart, decPart] = reais.split('.');

    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${withThousands},${decPart}`;
}

function parseBRLtoNumber(value: string): string {
    return value.replace(/\./g, '').replace(',', '.');
}

function numberToBRL(value: number): string {
    const reais = value.toFixed(2);
    const [intPart, decPart] = reais.split('.');
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${withThousands},${decPart}`;
}

// ─── Labels humanizados ─────────────────────────────────────────────────────
const METODO_LABELS: Record<string, string> = {
    PIX: 'PIX',
    TON: 'TON (Maquininha)',
    ESPECIE: 'Dinheiro',
};

const JANELA_24H_MS = 24 * 60 * 60 * 1000;
const METODOS_ENTRADA = ['PIX', 'TON', 'ESPECIE'];
const METODOS_SAIDA = ['PIX', 'ESPECIE'];
const DESC_MAX = 200;

const editarSchema = z.object({
    id: z.string().uuid(),
    tipo: z.enum(['ENTRADA', 'SAIDA']),
    valor: z.string()
        .min(1, 'Informe o valor')
        .refine((val) => {
            const num = parseFloat(parseBRLtoNumber(val));
            return !isNaN(num) && num > 0;
        }, 'O valor deve ser maior que zero'),
    descricao: z.string().max(200, 'Máximo 200 caracteres').optional(),
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

    const descricaoValue = form.watch('descricao') ?? '';

    // Pré-popula o form sempre que um lancamento diferente é aberto.
    useEffect(() => {
        if (lancamento) {
            const metodoSalvo = lancamento.metodo_pgto ?? 'PIX';
            const metodoNormalizado =
                lancamento.tipo === 'SAIDA' && metodoSalvo === 'TON' ? 'PIX' : metodoSalvo;
            form.reset({
                id: lancamento.id,
                tipo: lancamento.tipo,
                valor: numberToBRL(lancamento.valor),
                descricao: lancamento.descricao ?? '',
                metodo_pgto: metodoNormalizado,
            });
            setInlineError(null);
        }
    }, [lancamento, form]);

    const handleValorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
        const formatted = formatCurrency(e.target.value);
        onChange(formatted);
    }, []);

    const onSubmit = async (values: EditarFormValues) => {
        setInlineError(null);
        const formData = new FormData();
        formData.append('id', values.id);
        formData.append('tipo', values.tipo);
        formData.append('valor', parseBRLtoNumber(values.valor));
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
            <DialogContent className="max-h-[90vh] p-0 overflow-hidden gap-0" showCloseButton={false}>
                {/* Header verde escuro */}
                <div className="bg-primary px-6 py-5 relative">
                    <button
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="absolute top-4 right-4 text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                        aria-label="Fechar"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                    <DialogHeader className="px-0 text-left">
                        <DialogTitle className="text-primary-foreground text-lg">
                            Editar Lançamento
                        </DialogTitle>
                        <DialogDescription className="text-primary-foreground/60 text-sm">
                            {isEditavel
                                ? 'Altere os dados da transação.'
                                : 'Prazo de edição encerrado ou lançamento de outro usuário.'}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Form body */}
                <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-100px)]">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            <input type="hidden" {...form.register('id')} />

                            {/* Toggle Tipo */}
                            <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1.5 rounded-xl">
                                <button
                                    type="button"
                                    disabled={!isEditavel || isAnyPending}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
                                        isEntrada
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    onClick={() => form.setValue('tipo', 'ENTRADA')}
                                >
                                    <ArrowUpRight className="w-4 h-4" />
                                    Entrada
                                </button>
                                <button
                                    type="button"
                                    disabled={!isEditavel || isAnyPending}
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 ${
                                        !isEntrada
                                            ? 'bg-rose-500 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                    onClick={() => {
                                        form.setValue('tipo', 'SAIDA');
                                        if (form.getValues('metodo_pgto') === 'TON') {
                                            form.setValue('metodo_pgto', 'PIX');
                                        }
                                    }}
                                >
                                    <ArrowDownLeft className="w-4 h-4 -scale-x-100" />
                                    Saída
                                </button>
                            </div>

                            {/* Valor */}
                            <FormField
                                control={form.control}
                                name="valor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            Valor (R$) <span className="text-rose-500">*</span>
                                        </FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                                                    R$
                                                </span>
                                                <Input
                                                    inputMode="decimal"
                                                    placeholder="0,00"
                                                    className="pl-10 text-lg font-semibold h-12"
                                                    disabled={!isEditavel || isAnyPending}
                                                    value={field.value}
                                                    onChange={(e) => handleValorChange(e, field.onChange)}
                                                    onBlur={field.onBlur}
                                                    name={field.name}
                                                    ref={field.ref}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Descrição */}
                            <FormField
                                control={form.control}
                                name="descricao"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center justify-between">
                                            <FormLabel>Descrição</FormLabel>
                                            <span className={`text-xs ${descricaoValue.length > DESC_MAX ? 'text-rose-500 font-medium' : 'text-muted-foreground'}`}>
                                                {descricaoValue.length}/{DESC_MAX}
                                            </span>
                                        </div>
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

                            {/* Pagamento */}
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
                                                    <SelectItem key={m} value={m}>
                                                        {METODO_LABELS[m] ?? m}
                                                    </SelectItem>
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
                            <div className="flex gap-3 mt-2">
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
