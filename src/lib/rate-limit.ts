/**
 * Rate Limiter simples in-memory para Serveless Actions (NextJS).
 * Como rodamos num ambiente Serverless, as instâncias resetam frequentemente.
 * Para o MVP, isso serve como um limite básico contra bots rudimentares.
 * No futuro poderá ser substituído por Redis (Upstash) no Vercel.
 */

interface RateLimitInfo {
    count: number;
    lockUntil: number | null;
}

const memoryStore = new Map<string, RateLimitInfo>();

// Limites padrão (auth/login). Mutations usam parâmetros distintos na chamada.
const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_LOCKOUT_MINUTES = 15;

export function rateLimit(
    identifier: string,
    maxRequests: number = DEFAULT_MAX_REQUESTS,
    lockoutMinutes: number = DEFAULT_LOCKOUT_MINUTES,
): { success: boolean; message?: string } {
    const now = Date.now();
    const record = memoryStore.get(identifier);

    // Se não tem registro, cria um com 1 tentativa e expiração de 1 min.
    if (!record) {
        memoryStore.set(identifier, { count: 1, lockUntil: null });
        // Limpa o store após o tempo (para não vazar memória no longo prazo de uma instância ativa)
        setTimeout(() => memoryStore.delete(identifier), 60_000);
        return { success: true };
    }

    // Se já está trancado
    if (record.lockUntil && record.lockUntil > now) {
        const minLeft = Math.ceil((record.lockUntil - now) / 60_000);
        return { success: false, message: `Muitas tentativas. Bloqueado por mais ${minLeft} minutos.` };
    }

    // Se o lock expirou, reseta o contador
    if (record.lockUntil && record.lockUntil <= now) {
        record.count = 1;
        record.lockUntil = null;
        return { success: true };
    }

    // Se ainda está no minuto e passou das tentativas -> Bloqueia
    record.count++;
    if (record.count > maxRequests) {
        record.lockUntil = now + lockoutMinutes * 60_000;
        return { success: false, message: `Muitas tentativas. Bloqueado por ${lockoutMinutes} minutos.` };
    }

    return { success: true };
}
