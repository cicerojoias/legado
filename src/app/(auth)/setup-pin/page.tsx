'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PinPad } from '@/components/auth/pin-pad';
import { setupPinAction } from '../pin/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function SetupPinPage() {
    const [step, setStep] = useState<'create' | 'confirm'>('create');
    const [firstPin, setFirstPin] = useState('');
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const handlePinComplete = (pin: string) => {
        if (step === 'create') {
            setFirstPin(pin);
            setStep('confirm');
        } else {
            // Confirming PIN
            if (pin !== firstPin) {
                toast.error('Os PINs digitados não conferem. Tente novamente.');
                setFirstPin('');
                setStep('create');
                return;
            }

            // Both match, submit to Server
            startTransition(async () => {
                const res = await setupPinAction(firstPin, pin);
                if (res.success) {
                    toast.success('PIN configurado com sucesso!');
                    router.push('/hoje');
                } else {
                    toast.error(res.message);
                    setFirstPin('');
                    setStep('create');
                }
            });
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-muted/40">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Crie seu PIN</CardTitle>
                    <CardDescription>
                        {step === 'create'
                            ? 'Digite 4 números genéricos para acesso rápido ao sistema.'
                            : 'Confirme o PIN digitado para validarmos.'}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <PinPad
                        key={step} // Force re-render to clear the dots between steps
                        onComplete={handlePinComplete}
                        disabled={isPending}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
