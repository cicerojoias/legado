'use client';

import { useState, useCallback } from 'react';
import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as motion from 'framer-motion/client';

interface PinPadProps {
    onComplete: (pin: string) => void;
    error?: string;
    maxLength?: number;
    disabled?: boolean;
}

export function PinPad({ onComplete, error, maxLength = 4, disabled = false }: PinPadProps) {
    const [pin, setPin] = useState<string>('');

    const handlePress = useCallback((digit: string) => {
        if (disabled) return;
        setPin((prev) => {
            if (prev.length >= maxLength) return prev;
            const newPin = prev + digit;
            if (newPin.length === maxLength) {
                // Remove o onComplete de dentro do ciclo atual de renderização do state
                // para evitar "Cannot update a component while rendering a different component"
                setTimeout(() => onComplete(newPin), 0);
            }
            return newPin;
        });
    }, [maxLength, onComplete, disabled]);

    const handleDelete = useCallback(() => {
        if (disabled) return;
        setPin((prev) => prev.slice(0, -1));
    }, [disabled]);

    // O teclado é de 1 a 9, um espaço vazio, o 0 e o delete
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'];

    return (
        <div className="flex flex-col items-center gap-8 w-full max-w-xs mx-auto">
            {/* Visualizador do PIN (Bolinhas) */}
            <div className="flex justify-center gap-4 mb-4">
                {Array.from({ length: maxLength }).map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "w-4 h-4 rounded-full border-2 transition-all duration-200",
                            pin.length > i
                                ? "bg-primary border-primary scale-110"
                                : "bg-transparent border-muted-foreground/30",
                            error && "border-destructive/50 bg-destructive/20"
                        )}
                    />
                ))}
            </div>

            {error && (
                <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm font-medium text-destructive text-center"
                >
                    {error}
                </motion.p>
            )}

            {/* Teclado Numérico */}
            <div className="grid grid-cols-3 gap-4 w-full">
                {keys.map((key) => {
                    if (key === '') {
                        return <div key="spacer" />; // Espaço vazio para alinhar o 0 no meio
                    }

                    if (key === 'delete') {
                        return (
                            <button
                                key="delete"
                                type="button"
                                onClick={handleDelete}
                                disabled={disabled || pin.length === 0}
                                className="flex items-center justify-center w-[72px] h-[72px] mx-auto rounded-full active:bg-muted transition-colors disabled:opacity-50"
                                aria-label="Apagar último dígito"
                            >
                                <Delete className="w-6 h-6 text-muted-foreground" />
                            </button>
                        );
                    }

                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => handlePress(key)}
                            disabled={disabled}
                            className="flex items-center justify-center w-[72px] h-[72px] mx-auto rounded-full text-2xl font-semibold active:bg-accent/50 transition-colors border border-transparent hover:border-border/50 disabled:opacity-50 text-foreground"
                        >
                            {key}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
