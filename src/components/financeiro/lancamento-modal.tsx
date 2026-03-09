'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Loader2 } from 'lucide-react';
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

const lancamentoSchema = z.object({
    tipo: z.enum(['ENTRADA', 'SAIDA']),
    valor: z.string().min(1, 'Valor obrigatório'),
    descricao: z.string().min(1, 'Descrição obrigatória').max(200),
    categoria: z.string().optional(),
    metodo_pgto: z.string().optional(),
    loja: z.string().optional(),
    observacao: z.string().optional(),
    data_ref: z.string().optional(),
});

type FormValues = z.infer<typeof lancamentoSchema>;

const CATEGORIAS = ['BANHO_OURO', 'ALIANCA', 'ANEL_FORMATURA', 'CONSERTO', 'VENDA', 'DESPESA_FIXA', 'OUTROS'];
// TON (maquininha) só aparece em ENTRADA — saídas são pagas em PIX ou Dinheiro
const METODOS_ENTRADA = ['PIX', 'TON', 'ESPECIE'];
const METODOS_SAIDA = ['PIX', 'ESPECIE'];

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
            valor: '',
            descricao: '',
            categoria: '',
            metodo_pgto: 'PIX',
            loja: '',
            observacao: '',
        },
    });

    const isEntrada = form.watch('tipo') === 'ENTRADA';
    const metodosDisponiveis = isEntrada ? METODOS_ENTRADA : METODOS_SAIDA;

    const onSubmit = async (values: FormValues) => {
        const formData = new FormData();
        Object.entries(values).forEach(([key, val]) => {
            if (val) formData.append(key, val);
        });
        // Inject the current navigation date so the transaction is recorded on the correct day
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
            <DialogContent className="max-h-[90vh]">
                <div className="mx-auto w-full p-4 overflow-y-auto">
                    <DialogHeader className="px-0 text-left">
                        <DialogTitle>Novo Lançamento</DialogTitle>
                        <DialogDescription>Preencha os dados da transação.</DialogDescription>
                    </DialogHeader>

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            {/* Toggle Tipo */}
                            <div className="grid grid-cols-2 gap-2 bg-muted/40 p-1 rounded-xl">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className={`rounded-lg ${isEntrada ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:text-white' : 'text-muted-foreground'}`}
                                    onClick={() => form.setValue('tipo', 'ENTRADA')}
                                >
                                    📥 Entrada
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    className={`rounded-lg ${!isEntrada ? 'bg-rose-500 text-white hover:bg-rose-600 hover:text-white' : 'text-muted-foreground'}`}
                                    onClick={() => {
                                        form.setValue('tipo', 'SAIDA');
                                        if (form.getValues('metodo_pgto') === 'TON') {
                                            form.setValue('metodo_pgto', 'PIX');
                                        }
                                    }}
                                >
                                    📤 Saída
                                </Button>
                            </div>

                            <FormField
                                control={form.control}
                                name="valor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Valor (R$)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" inputMode="decimal" placeholder="0.00" {...field} />
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
                                            <Input placeholder="Venda de aliança, conserto..." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

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
                                                        <SelectItem key={m} value={m}>{m}</SelectItem>
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
                                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            {canSelectLoja && (
                                <FormField
                                    control={form.control}
                                    name="loja"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Loja</FormLabel>
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

                            <Button
                                type="submit"
                                className="w-full mt-6 py-6 rounded-2xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground active:scale-95 transition-all"
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
