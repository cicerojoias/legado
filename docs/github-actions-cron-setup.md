# 🔧 Configuração do GitHub Actions Cron - Passo a Passo

## ✅ O que foi criado

Um GitHub Action que executa automaticamente todos os dias às 18:00 UTC para enviar o resumo financeiro diário via push notifications.

---

## 📋 Configuração Necessária (5 minutos)

### Passo 1: Adicionar Secrets ao Repositório GitHub

1. Acesse seu repositório no GitHub
2. Vá em **Settings** → **Secrets and variables** → **Actions**
3. Clique em **New repository secret** e adicione:

#### Secret 1: `APP_URL`
- **Name**: `APP_URL`
- **Value**: URL da sua aplicação em produção
- **Exemplo**: `https://legadocicerojoias.vercel.app`

#### Secret 2: `CRON_SECRET`
- **Name**: `CRON_SECRET`
- **Value**: O mesmo token que está no seu `.env.local`
- **Exemplo**: `744c709d5ab240cfca8d24d97b526ef78501db9bc06bab14b7b96620fffe6305`

> **Como ver seu CRON_SECRET atual:**
> ```bash
> # No terminal, na raiz do projeto:
> grep CRON_SECRET .env.local
> ```

---

### Passo 2: Ajustar o Horário (Opcional)

O arquivo `.github/workflows/cron-daily-summary.yml` está configurado para executar às **18:00 UTC**.

**Conversão para horário de Brasília:**
- **Horário padrão (BRT)**: 18:00 UTC = **15:00 (3h da tarde)**
- **Horário de verão (BRST)**: 18:00 UTC = **14:00 (2h da tarde)**

**Se quiser executar às 18h de Brasília**, mude para:
- **Horário padrão**: `0 21 * * *` (21:00 UTC = 18:00 BRT)
- **Horário de verão**: `0 20 * * *` (20:00 UTC = 18:00 BRST)

**Para ajustar:**
1. Abra `.github/workflows/cron-daily-summary.yml`
2. Na linha 7, altere o cron expression
3. Commit e push

**Ferramenta útil**: https://crontab.guru/

---

### Passo 3: Testar Manualmente (Imediato)

Você pode testar sem esperar o horário agendado:

#### Opção 1: Via GitHub (Mais fácil)
1. Acesse seu repositório no GitHub
2. Vá em **Actions** → **Daily Financial Summary Cron**
3. Clique em **Run workflow** → **Run workflow**
4. Aguarde alguns segundos e veja os logs

#### Opção 2: Via Local (Durante desenvolvimento)
```bash
# Com o servidor rodando (npm run dev):
curl -X POST http://localhost:3000/api/cron/daily-summary
```

---

## 🔍 Monitoramento

### Verificar se funcionou

1. **No GitHub**:
   - Acesse **Actions** → clique no workflow executado
   - Veja os logs em tempo real
   - Deve mostrar: `✅ Resumo diário enviado com sucesso!`

2. **No Vercel (Logs da API)**:
   - Acesse o dashboard do Vercel
   - Vá em **Logs** → **Runtime Logs**
   - Procure por: `[cron/daily-summary]` ou `[push-dispatcher]`

3. **No celular/navegador**:
   - Você deve receber uma notificação push com o resumo financeiro

---

## 🐛 Troubleshooting

### "Workflow falhou com exit code 1"

**Causa**: Secrets não configurados corretamente.

**Solução**:
1. Verifique se `APP_URL` e `CRON_SECRET` estão nos secrets do repositório
2. Verifique se o `CRON_SECRET` no GitHub é **igual** ao do `.env.local`
3. Redeploy da aplicação no Vercel para garantir que o `CRON_SECRET` está configurado

### "Erro 401 - Não autorizado"

**Causa**: `CRON_SECRET` diferente entre GitHub e Vercel.

**Solução**:
```bash
# 1. Gere um novo token
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Atualize em 3 lugares:
#    - .env.local
#    - GitHub Secrets (CRON_SECRET)
#    - Vercel Environment Variables (CRON_SECRET)

# 3. Redeploy no Vercel
```

### "Erro 500 - Erro interno"

**Causa**: Problema na execução da API.

**Solução**:
1. Verifique os logs no Vercel para ver o erro específico
2. Verifique se as variáveis VAPID estão configuradas no Vercel
3. Verifique se há usuários com subscriptions ativas no banco

### "Notificação não apareceu"

**Verificações**:
1. ✅ `notif_push = true` no perfil do usuário
2. ✅ Role do usuário é ADMIN ou SUPER_ADMIN
3. ✅ Subscription ativa no banco: `SELECT * FROM "WaPushSubscription"`
4. ✅ Permissão de notificação concedida no navegador
5. ✅ PWA instalado ou site aberto recentemente (Service Worker ativo)

---

## 📊 Exemplo de Log Esperado

```
Iniciando disparo do resumo diário...
Código HTTP: 200
Resposta: {"success":true,"message":"Resumo diário enviado com sucesso","timestamp":"2026-04-28T18:00:00.000Z"}
✅ Resumo diário enviado com sucesso!
Detalhes: [push-dispatcher] Enviando resumo diário para 2 usuário(s)
         [push-dispatcher] Resumo diário enviado com sucesso para 2 usuário(s)
```

---

## ⚙️ Configurações Avançadas

### Executar em Múltiplos Horários

Se quiser enviar resumo em mais de um horário por dia:
```yaml
schedule:
  - cron: '0 18 * * *'  # 18:00 UTC
  - cron: '0 12 * * *'  # 12:00 UTC (resumo do meio-dia)
```

### Notificar Apenas em Dias Úteis

```yaml
schedule:
  - cron: '0 18 * * 1-5'  # Segunda a Sexta
```

### Adicionar Notificação de Falha

Você pode configurar o GitHub para enviar um email se o workflow falhar:
1. Settings → Notifications
2. Ativar "Failed workflow notifications"

---

## 🎯 Checklist Final

- [ ] Adicionar `APP_URL` nos secrets do GitHub
- [ ] Adicionar `CRON_SECRET` nos secrets do GitHub
- [ ] Adicionar `CRON_SECRET` nas variáveis de ambiente do Vercel
- [ ] Testar manualmente via GitHub Actions
- [ ] Verificar logs no Vercel
- [ ] Confirmar recebimento de notificação push
- [ ] Ajustar horário se necessário

---

## 💡 Dica Pro

O GitHub Actions permite **execuções manuais**, o que é perfeito para:
- Testes após deploy
- Envio de resumo sob demanda
- Verificar se tudo está funcionando sem esperar o horário agendado

Basta ir em **Actions** → **Daily Financial Summary Cron** → **Run workflow**

---

## 📞 Precisa de Ajuda?

Se tiver problemas:
1. Verifique os logs do GitHub Actions
2. Verifique os logs do Vercel
3. Teste localmente com `curl`
4. Consulte a documentação completa em `docs/notificacoes-guia.md`
