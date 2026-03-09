'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Loja } from '@prisma/client';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';
import { useState } from 'react';

interface FilterBarProps {
    initialFilters: {
        from?: string;
        to?: string;
        loja?: string;
        tipo?: string;
    };
    lojaAutorizada: Loja;
}

export function FilterBar({ initialFilters, lojaAutorizada }: FilterBarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [from, setFrom] = useState(initialFilters.from || '');
    const [to, setTo] = useState(initialFilters.to || '');
    const [loja, setLoja] = useState(initialFilters.loja || 'AMBAS');
    const [tipo, setTipo] = useState(initialFilters.tipo || 'TODOS');

    const handleApply = () => {
        const params = new URLSearchParams(searchParams.toString());
        if (from) params.set('from', from); else params.delete('from');
        if (to) params.set('to', to); else params.delete('to');
        if (loja && loja !== 'AMBAS') params.set('loja', loja); else params.delete('loja');
        if (tipo && tipo !== 'TODOS') params.set('tipo', tipo); else params.delete('tipo');

        router.push(`/lancamentos?${params.toString()}`);
    };

    const handleClear = () => {
        setFrom(initialFilters.from || '');
        setTo(initialFilters.to || '');
        setLoja('AMBAS');
        setTipo('TODOS');
        router.push('/lancamentos');
    };

    return (
        <div className="flex flex-wrap items-end gap-3 p-1">
            <div className="grid gap-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">De</label>
                <Input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-9 w-[140px] bg-background/50 border-none shadow-none ring-1 ring-border focus-visible:ring-primary"
                />
            </div>

            <div className="grid gap-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Até</label>
                <Input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-9 w-[140px] bg-background/50 border-none shadow-none ring-1 ring-border focus-visible:ring-primary"
                />
            </div>

            {lojaAutorizada === 'AMBAS' && (
                <div className="grid gap-1.5">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Loja</label>
                    <Select value={loja} onValueChange={setLoja}>
                        <SelectTrigger className="h-9 w-[130px] bg-background/50 border-none shadow-none ring-1 ring-border">
                            <SelectValue placeholder="Loja" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="AMBAS">Todas</SelectItem>
                            <SelectItem value="JOAO_PESSOA">J. Pessoa</SelectItem>
                            <SelectItem value="SANTA_RITA">S. Rita</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            <div className="grid gap-1.5">
                <label className="text-[10px] font-bold uppercase text-muted-foreground ml-1">Tipo</label>
                <Select value={tipo} onValueChange={setTipo}>
                    <SelectTrigger className="h-9 w-[110px] bg-background/50 border-none shadow-none ring-1 ring-border">
                        <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="TODOS">Todos</SelectItem>
                        <SelectItem value="ENTRADA">Entradas</SelectItem>
                        <SelectItem value="SAIDA">Saídas</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    size="icon"
                    variant="default"
                    className="h-9 w-9 rounded-md shadow-lg shadow-primary/20"
                    onClick={handleApply}
                >
                    <Search className="h-4 w-4" />
                </Button>

                <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 rounded-md border"
                    onClick={handleClear}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
