'use client';

import { useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { toast } from 'sonner';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
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

import { createLancamento } from '@/app/(protected)/hoje/actions';

// ─── Helpers de formatação BRL (estilo transferência bancária) ───────────────
function formatCurrency(value: string): string {
    // Extrai apenas dígitos
    const digits = value.replace(/\D/g, '');
    if (!digits) return '0,00';

    // Converte para centavos e formata
    const cents = parseInt(digits, 10);
    const reais = (cents / 100).toFixed(2);
    const [intPart, decPart] = reais.split('.');

    // Adiciona pontos de milhar
    const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

    return `${withThousands},${decPart}`;
}

function parseBRLtoNumber(value: string): string {
    // Converte "1.500,50" para "1500.50"
    return value.replace(/\./g, '').replace(',', '.');
}

// ─── Labels humanizados ─────────────────────────────────────────────────────
const CATEGORIA_LABELS: Record<string, string> = {
    BANHO_OURO: 'Banho de Ouro',
    ALIANCA: 'Aliança',
    ANEL_FORMATURA: 'Anel de Formatura',
    CONSERTO: 'Conserto',
    VENDA: 'Venda',
    DESPESA_FIXA: 'Despesa Fixa',
    OUTROS: 'Outros',
};

const METODO_LABELS: Record<string, string> = {
    PIX: 'PIX',
    TON: 'TON (Maquininha)',
    ESPECIE: 'Dinheiro',
};

const CATEGORIAS = Object.keys(CATEGORIA_LABELS);
const METODOS_ENTRADA = ['PIX', 'TON', 'ESPECIE'];
const METODOS_SAIDA = ['PIX', 'ESPECIE'];

// ─── Schema ─────────────────────────────────────────────────────────────────
const lancamentoSchema = z.object({
    tipo: z.enum(['ENTRADA', 'SAIDA']),
    valor: z.string()
        .min(1, 'Informe o valor')
        .refine((val) => {
            const num = parseFloat(parseBRLtoNumber(val));
            return !isNaN(num) && num > 0;
        }, 'O valor deve ser maior que zero'),
    descricao: z.string().max(200, 'Máximo 200 caracteres').optional(),
    categoria: z.string().optional(),
    metodo_pgto: z.string().optional(),
    loja: z.string().optional(),
    observacao: z.string().optional(),
    data_ref: z.string().optional(),
});

type FormValues = z.infer<typeof lancamentoSchema>;

const DESC_MAX = 200;

export function LancamentoModal({ canSelectLoja = false }: { canSelectLoja?: boolean }) {
    const [open, setOpen] = useState(false);
    const searchParams = useSearchParams();
    const tzOffset = -3 * 60 * 60 * 1000;
    const brazilDate = new Date(Date.now() + tzOffset).toISOString().split('T')[0];
    const currentDate = searchParams.get('date') ?? brazilDate;

    const form = useForm<FormValues>({
        resolver: zodResolver(lancamentoSchema),
        defaultValues: {
            tipo: 'ENTRADA',
            valor: '0,00',
            descricao: '',
            categoria: '',
            metodo_pgto: 'PIX',
            loja: '',
            observacao: '',
        },
    });

    const isEntrada = form.watch('tipo') === 'ENTRADA';
    const descricaoValue = form.watch('descricao') ?? '';
    const metodosDisponiveis = isEntrada ? METODOS_ENTRADA : METODOS_SAIDA;

    const handleValorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, onChange: (value: string) => void) => {
        const formatted = formatCurrency(e.target.value);
        onChange(formatted);
    }, []);

    const onSubmit = async (values: FormValues) => {
        const formData = new FormData();

        // Converte valor BRL para formato numérico
        const valorNumerico = parseBRLtoNumber(values.valor);
        formData.append('tipo', values.tipo);
        formData.append('valor', valorNumerico);
        if (values.descricao) formData.append('descricao', values.descricao);
        if (values.categoria) formData.append('categoria', values.categoria);
        if (values.metodo_pgto) formData.append('metodo_pgto', values.metodo_pgto);
        if (values.loja) formData.append('loja', values.loja);
        if (values.observacao) formData.append('observacao', values.observacao);
        formData.set('data_ref', currentDate);

        toast.promise(createLancamento(formData), {
            loading: 'Salvando...',
            success: (data) => {
                if (data.error) throw new Error(data.error);
                setOpen(false);
                form.reset();
                return 'Lançamento registrado com sucesso!';
            },
            error: (err) => err.message || 'Erro ao registrar',
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <div className="flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-all text-primary hover:text-primary/80">
                    <div className="bg-primary text-primary-foreground p-3 rounded-full shadow-lg shadow-primary/20 mb-1 -mt-6 border-4 border-card relative z-10">
                        <Plus className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] font-medium leading-none font-bold">Registrar</span>
                </div>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] p-0 overflow-hidden gap-0" showCloseButton={false} onInteractOutside={(e) => e.preventDefault()}>
                {/* Header verde escuro */}
                <div className="bg-primary px-6 py-5 relative">
                    <button
                        type="button"
                        onClick={() => setOpen(false)}
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
                            Novo Lançamento
                        </DialogTitle>
                        <DialogDescription className="text-primary-foreground/60 text-sm">
                            Preencha os dados da transação.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Form body */}
                <div className="px-6 py-5 overflow-y-auto max-h-[calc(90vh-100px)]">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                            {/* Toggle Tipo */}
                            <div className="grid grid-cols-2 gap-2 bg-muted/60 p-1.5 rounded-xl">
                                <button
                                    type="button"
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
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
                                    className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
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
                                            <Input placeholder="Venda de aliança, conserto..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Pagamento + Categoria */}
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="metodo_pgto"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Pagamento</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
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

                                <FormField
                                    control={form.control}
                                    name="categoria"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Categoria</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Opcional" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {CATEGORIAS.map((c) => (
                                                        <SelectItem key={c} value={c}>
                                                            {CATEGORIA_LABELS[c] ?? c}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {/* Loja */}
                            {canSelectLoja && (
                                <FormField
                                    control={form.control}
                                    name="loja"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                Loja <span className="text-rose-500">*</span>
                                            </FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione a loja..." />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="JOAO_PESSOA">João Pessoa</SelectItem>
                                                    <SelectItem value="SANTA_RITA">Santa Rita</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            {/* Submit */}
                            <Button
                                type="submit"
                                className="w-full mt-2 py-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 transition-all"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    'Confirmar Lançamento'
                                )}
                            </Button>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}
