'use client';

import { useTransition, useEffect, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { LoginSchema } from '@/lib/validations';
import { loginAction } from './actions';
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

type LoginFormValues = z.infer<typeof LoginSchema>;

// Só os avisos dependem da URL: ficam isolados no Suspense para o formulário
// (e o logo) virem prontos no HTML do servidor.
function LoginAvisos() {
    const searchParams = useSearchParams();

    useEffect(() => {
        if (searchParams.get('message') === 'senha_atualizada') {
            toast.success('Senha atualizada com sucesso. Faça login para continuar.');
        }
        if (searchParams.get('error') === 'link_invalido') {
            toast.error('Link inválido ou expirado. Solicite um novo.');
        }
    }, [searchParams]);

    return null;
}

function LoginForm() {
    const [isPending, startTransition] = useTransition();

    const form = useForm<LoginFormValues>({
        resolver: zodResolver(LoginSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    function onSubmit(data: LoginFormValues) {
        startTransition(async () => {
            const formData = new FormData();
            formData.append('email', data.email);
            formData.append('password', data.password);

            const result = await loginAction(formData);

            if (result && !result.success) {
                toast.error(result.message);
                // We use a toast to present the error generically without stack traces.
            }
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
                        preload
                    />
                    <CardDescription>Acesse sua conta para continuar</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>E-mail</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="seu@email.com"
                                                type="email"
                                                autoCapitalize="none"
                                                autoComplete="email"
                                                autoCorrect="off"
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
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Senha</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="••••••••"
                                                type="password"
                                                autoComplete="current-password"
                                                disabled={isPending}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full" disabled={isPending}>
                                {isPending ? 'Entrando...' : 'Entrar'}
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function LoginPage() {
    return (
        <>
            <Suspense fallback={null}>
                <LoginAvisos />
            </Suspense>
            <LoginForm />
        </>
    );
}
