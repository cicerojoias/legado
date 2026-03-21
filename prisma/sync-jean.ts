import "dotenv/config";
import { prisma } from '../src/lib/prisma'

async function main() {
    const email = "jeangabriel.snascimento@gmail.com"
    const id = "6ed3b1b4-50c7-477d-9d7d-555909222cb8"
    const nome = "Jean"

    console.log(`🚀 Sincronizando Usuário [${id}]: ${email}...`)

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            id,
            nome,
            role: 'OPERADOR',
            lojaAutorizada: 'SANTA_RITA',
            lojaPadrao: 'SANTA_RITA',
            ativo: true,
            pin_hash: null, // Garante que o PIN seja resetado
        },
        create: {
            id,
            email,
            nome,
            role: 'OPERADOR',
            lojaAutorizada: 'SANTA_RITA',
            lojaPadrao: 'SANTA_RITA',
            ativo: true,
        },
    })

    console.log('✅ Usuário Jean sincronizado com sucesso:')
    console.log(user)
}

main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
