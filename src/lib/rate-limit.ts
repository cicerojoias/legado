import { Redis } from '@upstash/redis';

interface RateLimitInfo {
    count: number;
    lockUntil: number | null;
}

// Fallback in-memory para desenvolvimento local (sem env vars do Upstash)
const memoryStore = new Map<string, RateLimitInfo>();

const DEFAULT_MAX_REQUESTS = 5;
const DEFAULT_LOCKOUT_MINUTES = 15;

let _redis: Redis | null = null;

function getRedis(): Redis | null {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null;
    }
    if (!_redis) {
        _redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
    }
    return _redis;
}

export async function rateLimit(
    identifier: string,
    maxRequests: number = DEFAULT_MAX_REQUESTS,
    lockoutMinutes: number = DEFAULT_LOCKOUT_MINUTES,
): Promise<{ success: boolean; message?: string }> {
    const redis = getRedis();
    if (redis) {
        return rateLimitRedis(redis, identifier, maxRequests, lockoutMinutes);
    }
    return rateLimitMemory(identifier, maxRequests, lockoutMinutes);
}

async function rateLimitRedis(
    redis: Redis,
    identifier: string,
    maxRequests: number,
    lockoutMinutes: number,
): Promise<{ success: boolean; message?: string }> {
    const lockKey = `rl:lock:${identifier}`;
    const countKey = `rl:count:${identifier}`;

    // Verifica se está bloqueado
    const lockTtl = await redis.ttl(lockKey);
    if (lockTtl > 0) {
        const minLeft = Math.ceil(lockTtl / 60);
        return { success: false, message: `Muitas tentativas. Bloqueado por mais ${minLeft} minutos.` };
    }

    // Incrementa o contador (janela de 60s)
    const count = await redis.incr(countKey);
    if (count === 1) {
        // Primeiro request da janela — define TTL de 60s
        await redis.expire(countKey, 60);
    }

    if (count > maxRequests) {
        // Aplica o bloqueio e reseta o contador
        await redis.set(lockKey, '1', { ex: lockoutMinutes * 60 });
        await redis.del(countKey);
        return { success: false, message: `Muitas tentativas. Bloqueado por ${lockoutMinutes} minutos.` };
    }

    return { success: true };
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
