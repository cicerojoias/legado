import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter,
        // Em desenvolvimento loga queries pesadas
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

// Graceful shutdown: libera conexões do pool no SIGTERM (deploys, scale-to-zero)
// Evita que conexões órfãs acumulem até o limite do pooler do Supabase
function gracefulShutdown(signal: string) {
    console.log(`[prisma] ${signal} recebido — encerrando pool de conexões...`)
    void prisma.$disconnect().then(() => {
        pool.end().then(() => {
            console.log('[prisma] Pool encerrado com sucesso')
            process.exit(0)
        }).catch((err) => {
            console.error('[prisma] Erro ao encerrar pool:', err)
            process.exit(1)
        })
    }).catch((err) => {
        console.error('[prisma] Erro ao desconectar Prisma:', err)
        pool.end().catch(() => {})
        process.exit(1)
    })
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
process.on('SIGINT', () => gracefulShutdown('SIGINT'))
