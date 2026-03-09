'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PinPad } from '@/components/auth/pin-pad';
import { verifyPinAction } from './actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export function PinVerificationClient({ userName }: { userName: string }) {
    const [isPending, startTransition] = useTransition();
    const [errorMsg, setErrorMsg] = useState('');
    const [key, setKey] = useState(0); // Used to clear the PinPad on error
    const router = useRouter();

    const handlePinComplete = (pin: string) => {
        setErrorMsg('');
        startTransition(async () => {
            const res = await verifyPinAction(pin);
            if (res.success) {
                router.push('/hoje');
            } else {
                if (res.redirect) {
                    router.push(res.redirect);
                    return;
                }
                const msg = ('message' in res ? res.message : undefined) ?? 'Erro desconhecido.';
                setErrorMsg(msg);
                setKey(k => k + 1); // Reset PinPad
                toast.error('PIN Inválido', { description: msg });
            }
        });
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-muted/40">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Olá, {userName.split(' ')[0]}</CardTitle>
                    <CardDescription>
                        Insira seu PIN de 4 dígitos para acessar o sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PinPad
                        key={key}
                        onComplete={handlePinComplete}
                        disabled={isPending}
                        error={errorMsg}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
