import "dotenv/config";
import { prisma } from '../src/lib/prisma'

async function main() {
    const email = "severinoalbuquerque001@gmail.com"
    const id = "184b4e56-4f60-46d1-9661-3e88d4072afe"
    const nome = "Severino"

    console.log(`🚀 Sincronizando Usuário [${id}]: ${email}...`)

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            id, 
            nome,
            role: 'OPERADOR',
            lojaAutorizada: 'AMBAS',
            lojaPadrao: 'JOAO_PESSOA',
            ativo: true,
            pin_hash: null, // Garante que o PIN seja resetado
        },
        create: {
            id,
            email,
            nome,
            role: 'OPERADOR',
            lojaAutorizada: 'AMBAS',
            lojaPadrao: 'JOAO_PESSOA',
            ativo: true,
        },
    })

    console.log('✅ Usuário Severino sincronizado com sucesso:')
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
