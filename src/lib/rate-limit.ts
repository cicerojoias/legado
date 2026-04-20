interface RateLimitInfo {
    count: number;
    lockUntil: number | null;
}

const memoryStore = new Map<string, RateLimitInfo>();

const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_LOCKOUT_MINUTES = 15;

export function rateLimit(
    identifier: string,
    maxRequests: number = DEFAULT_MAX_REQUESTS,
    lockoutMinutes: number = DEFAULT_LOCKOUT_MINUTES,
): { success: boolean; message?: string } {
    return rateLimitMemory(identifier, maxRequests, lockoutMinutes);
}

function rateLimitMemory(
    identifier: string,
    maxRequests: number,
    lockoutMinutes: number,
): { success: boolean; message?: string } {
    const now = Date.now();
    const record = memoryStore.get(identifier);

    if (!record) {
        memoryStore.set(identifier, { count: 1, lockUntil: null });
        setTimeout(() => memoryStore.delete(identifier), 60_000);
        return { success: true };
    }

    if (record.lockUntil && record.lockUntil > now) {
        const minLeft = Math.ceil((record.lockUntil - now) / 60_000);
        return { success: false, message: `Muitas tentativas. Bloqueado por mais ${minLeft} minutos.` };
    }

    if (record.lockUntil && record.lockUntil <= now) {
        record.count = 1;
        record.lockUntil = null;
        return { success: true };
    }

    record.count++;
    if (record.count > maxRequests) {
        record.lockUntil = now + lockoutMinutes * 60_000;
        return { success: false, message: `Muitas tentativas. Bloqueado por ${lockoutMinutes} minutos.` };
    }

    return { success: true };
}
