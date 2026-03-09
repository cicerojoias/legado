import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

/**
 * Gera hash seguro do PIN usando scrypt com salt aleatório.
 * Formato armazenado: "salt:hash" (hex).
 */
export function hashPin(pin: string): string {
    const salt = randomBytes(16).toString('hex');
    const hash = scryptSync(pin, salt, 64).toString('hex');
    return `${salt}:${hash}`;
}

/**
 * Compara PIN em texto plano contra o hash armazenado.
 * Usa timingSafeEqual para prevenir timing attacks.
 */
export function comparePin(pin: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    const hashedBuffer = scryptSync(pin, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return timingSafeEqual(hashedBuffer, keyBuffer);
}
