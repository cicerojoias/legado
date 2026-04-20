'use client';

import { useActionState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { resetPasswordAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { useEffect } from 'react';

const Schema = z
    .object({
        password: z.string().min(6, 'A senha deve ter no mínimo 6 caracteres'),
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: 'As senhas não coincidem',
        path: ['confirmPassword'],
    });

type FormValues = z.infer<typeof Schema>;

export default function ResetPasswordPage() {
    const [isPending, startTransition] = useTransition();
    const [state, formAction] = useActionState(resetPasswordAction, null);

    const form = useForm<FormValues>({
        resolver: zodResolver(Schema),
        defaultValues: { password: '', confirmPassword: '' },
    });

    useEffect(() => {
        if (state && !state.success) {
            toast.error(state.message);
        }
    }, [state]);

    function onSubmit(data: FormValues) {
        startTransition(() => {
            const fd = new FormData();
            fd.append('password', data.password);
            fd.append('confirmPassword', data.confirmPassword);
            formAction(fd);
        });
    }

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-muted/40">
            <Card className="w-full max-w-sm">
                <CardHeader className="flex flex-col items-center text-center gap-2">
                    <Image
                        src="/assets/logos/workmark.webp"
                        alt="Cícero Joias"
                        width={180}
                        height={60}
                        className="object-contain rounded-lg"
                        priority
                    />
                    <CardDescription>Defina sua nova senha</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Nova senha</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                                disabled={isPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirmar senha</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="password"
                                                placeholder="••••••••"
                                                autoComplete="new-password"
                                                disabled={isPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? 'Salvando...' : 'Salvar nova senha'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
