'use client';

import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { X, Plus, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { criarCustoFixo, editarCustoFixo } from '@/app/(protected)/custos-fixos/actions';

interface CustoParaEditar {
    id: string;
    nome: string;
    valor: number;
    loja: 'JOAO_PESSOA' | 'SANTA_RITA' | 'AMBAS';
    dia_venc: number;
}

interface CustoFixoFormProps {
    custo?: CustoParaEditar;
    onClose: () => void;
}

const LOJA_LABELS = {
    JOAO_PESSOA: 'João Pessoa',
    SANTA_RITA:  'Santa Rita',
    AMBAS:       'Ambas as Lojas',
};

export function CustoFixoForm({ custo, onClose }: CustoFixoFormProps) {
    const formRef = useRef<HTMLFormElement>(null);
    const [isPending, startTransition] = useTransition();
    const [loja, setLoja] = useState<string>(custo?.loja ?? 'JOAO_PESSOA');
    const isEditing = !!custo;

    function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        formData.set('loja', loja);

        startTransition(async () => {
            const result = isEditing
                ? await editarCustoFixo(formData)
                : await criarCustoFixo(formData);

            if (result.success) {
                toast.success(isEditing ? 'Custo fixo atualizado.' : 'Custo fixo cadastrado.');
                onClose();
            } else {
                toast.error(result.error);
            }
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl p-6 space-y-4 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold">
                        {isEditing ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-muted transition-colors"
                    >
                        <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>

                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                    {isEditing && <input type="hidden" name="id" value={custo.id} />}

                    {/* Nome */}
                    <div className="space-y-1.5">
                        <Label htmlFor="nome">Descrição</Label>
                        <Input
                            id="nome"
                            name="nome"
                            placeholder="Ex: Aluguel JP, Energia SR"
                            defaultValue={custo?.nome}
                            required
                        />
                    </div>

                    {/* Valor */}
                    <div className="space-y-1.5">
                        <Label htmlFor="valor">Valor mensal (R$)</Label>
                        <Input
                            id="valor"
                            name="valor"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            defaultValue={custo?.valor}
                            required
                        />
                    </div>

                    {/* Loja */}
                    <div className="space-y-1.5">
                        <Label>Loja</Label>
                        <Select value={loja} onValueChange={setLoja}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione a loja" />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(LOJA_LABELS).map(([value, label]) => (
                                    <SelectItem key={value} value={value}>
                                        {label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Dia de vencimento */}
                    <div className="space-y-1.5">
                        <Label htmlFor="dia_venc">Dia do vencimento</Label>
                        <Input
                            id="dia_venc"
                            name="dia_venc"
                            type="number"
                            min="1"
                            max="31"
                            placeholder="Ex: 5"
                            defaultValue={custo?.dia_venc}
                            required
                        />
                    </div>

                    {/* Ações */}
                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={onClose}
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            className="flex-1 bg-[#184434] hover:bg-[#122b20] text-white"
                            disabled={isPending}
                        >
                            {isPending ? (
                                'Salvando...'
                            ) : isEditing ? (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Salvar
                                </>
                            ) : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Cadastrar
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}
