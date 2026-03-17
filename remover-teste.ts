import "dotenv/config";
import { createClient } from '@supabase/supabase-js';
import { prisma } from './src/lib/prisma';

// Usar o service_role key para conseguir deletar usuários da Auth pelo Admin API
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing Supabase credentials in .env");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function main() {
  console.log("Buscando usuários no banco de dados local...");
  const devUsers = await prisma.user.findMany({
    where: {
        email: {
            in: ["admin@teste.com", "operador@teste.com"]
        }
    }
  });

  if (devUsers.length === 0) {
    console.log("Nenhum usuário de teste encontrado no banco.");
    return;
  }

  console.log("Usuários a serem removidos:", devUsers.map(u => ({ nome: u.nome, email: u.email })));

  for (const user of devUsers) {
    console.log(`\nProcessando: ${user.email} (${user.id})`);
    
    // 1. Tentar deletar do Supabase Auth
    try {
        console.log(`Deletando ${user.email} do Supabase Auth...`);
        const { data, error } = await supabase.auth.admin.deleteUser(user.id);
        if (error) {
            console.log(`⚠️ Erro/Aviso ao deletar do Supabase Auth (pode ser falta de permissão admin):`, error.message);
        } else {
            console.log(`✅ Deletado do Supabase Auth.`);
        }
    } catch (authErr) {
        console.log(`⚠️ Falha ao tentar excluir do Supabase Auth:`, authErr);
    }
    
    // 2. Deletar do banco local (Prisma)
    try {
        await prisma.user.delete({
            where: { id: user.id }
        });
        console.log(`✅ ${user.email} deletado do banco de dados local.`);
    } catch (e: any) {
        if (e.code === 'P2003') {
           console.log(`⚠️ ${user.email} possui registros vinculados (relatórios/lançamentos). Atualizando status para INATIVO.`);
           await prisma.user.update({
               where: { id: user.id },
               data: { ativo: false, email: `deleted_${Date.now()}_${user.email}` } // altera email pra liberar caso queira usar de novo
           });
           console.log(`✅ ${user.email} desativado com sucesso.`);
        } else {
             console.error(`❌ Erro ao deletar ${user.email} do banco local:`, e.message);
             console.error(e);
        }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  });
