# 📊 Sistema de Notificações Push - Guia de Configuração e Testes

## ✅ Funcionalidades Implementadas

### 1. Notificações WAB (WhatsApp Business)
- **Quem recebe**: ADMIN, SUPER_ADMIN e GERENTE
- **Quando**: Ao receber novas mensagens do WhatsApp
- **Respeita configuração**: `notif_push = true`

### 2. Resumo Financeiro Diário às 18h
- **Quem recebe**: ADMIN e SUPER_ADMIN apenas
- **Quando**: Todos os dias às 18:00 (configurável via Vercel Cron)
- **Conteúdo**: Entradas, Saídas, Saldo, número de lançamentos
- **Respeita configuração**: `notif_push = true`

---

## 🔧 Configuração Necessária

### 1. Adicionar variável de ambiente CRON_SECRET

Gere um token seguro:
```bash
openssl rand -hex 32
# ou no Windows:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Adicione ao `.env` (local) e às variáveis de ambiente do Vercel (produção):
```env
CRON_SECRET=seu_token_aqui
```

### 2. Configurar Cron Job (Escolha uma opção)

#### ✅ Opção Recomendada: GitHub Actions (Gratuito)

**Arquivo criado**: `.github/workflows/cron-daily-summary.yml`

**Vantagens**:
- ✅ Totalmente gratuito
- ✅ Confiável e fácil de configurar
- ✅ Permite execução manual para testes
- ✅ Logs detalhados no GitHub

**Como usar**:
1. Configure os secrets no GitHub (APP_URL e CRON_SECRET)
2. Adicione CRON_SECRET no Vercel
3. Commit e push
4. Teste via GitHub Actions → Run workflow

**Documentação completa**: [github-actions-cron-setup.md](./github-actions-cron-setup.md)

**Checklist rápido**: [CHECKLIST-CRON.md](../CHECKLIST-CRON.md)

#### ⚠️ Vercel Cron (Requer Plano Pro - $20/mês)

O Vercel Cron está configurado no `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/daily-summary",
      "schedule": "0 18 * * *"
    }
  ]
}
```

**Importante**: Só funciona em projetos com plano **Pro** ou superior. Se estiver no plano gratuito, use GitHub Actions (configurado acima).

---

## 🧪 Testes

### Teste Local (Desenvolvimento)

1. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

2. Teste a API de resumo diário via GET (permitido apenas em dev):
```
http://localhost:3000/api/cron/daily-summary
```

Ou via POST com curl:
```bash
curl -X POST http://localhost:3000/api/cron/daily-summary \
  -H "Authorization: Bearer seu_cron_secret_aqui" \
  -H "Content-Type: application/json"
```

### Teste em Produção

Via curl:
```bash
curl -X POST https://seu-dominio.vercel.app/api/cron/daily-summary \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

## 📋 Pré-requisitos para Receber Notificações

### Para o Usuário

1. **Login** como ADMIN, SUPER_ADMIN ou GERENTE
2. **Ativar notificações** no Perfil → Notificações Push
3. **Permitir notificações** no navegador/PWA quando solicitado
4. **Ter subscription ativa** no banco (tabela `WaPushSubscription`)

### Verificação no Banco

```sql
-- Verificar usuários elegíveis para WAB
SELECT id, nome, role, notif_push, ativo 
FROM "User" 
WHERE role IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE') 
  AND ativo = true;

-- Verificar subscriptions ativas
SELECT s.*, u.nome, u.role 
FROM "WaPushSubscription" s
JOIN "User" u ON s."userId" = u.id
WHERE u.role IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE');

-- Verificar usuários elegíveis para resumo diário
SELECT id, nome, role, notif_push, ativo 
FROM "User" 
WHERE role IN ('ADMIN', 'SUPER_ADMIN') 
  AND ativo = true 
  AND notif_push = true;
```

---

## 🔍 Logs e Debug

### Logs do Servidor

Procure por:
```
[push-dispatcher] Enviando resumo diário para X usuário(s)
[push-dispatcher] Resumo diário enviado com sucesso para X usuário(s)
[cron/daily-summary] Iniciando envio de resumo diário
```

### Logs do Browser

Abra o DevTools → Console do Service Worker:
```
[push] Subscription registrada com sucesso
[push] Notificação recebida
```

### Testar Subscription

No console do browser (F12):
```javascript
// Verificar permissão
Notification.permission // deve ser "granted"

// Verificar subscription
const reg = await navigator.serviceWorker.ready;
const sub = await reg.pushManager.getSubscription();
console.log(sub); // deve retornar um objeto PushSubscription
```

---

## ⚙️ Alternativas ao GitHub Actions

Se por algum motivo não quiser usar GitHub Actions, aqui estão outras opções gratuitas:

### Opção 1: Cron-job.org (serviço gratuito)

1. Acesse https://cron-job.org
2. Crie conta gratuita
3. Configure:
   - URL: `https://seu-dominio.vercel.app/api/cron/daily-summary`
   - Schedule: `0 18 * * *`
   - Header: `Authorization: Bearer seu_cron_secret`

### Opção 2: Cronitor.io (plano gratuito)

1. Acesse https://cronitor.io
2. Crie conta gratuita (suporta até 5 monitors)
3. Configure cron job com:
   - Endpoint: `https://seu-dominio.vercel.app/api/cron/daily-summary`
   - Method: POST
   - Headers: `Authorization: Bearer seu_cron_secret`

---

## 🐛 Problemas Comuns

### Notificações não aparecem

1. Verifique permissão do navegador: `Notification.permission === 'granted'`
2. Verifique subscription no banco: `SELECT * FROM "WaPushSubscription"`
3. Verifique `notif_push` do usuário: deve ser `true`
4. Verifique role do usuário: deve ser ADMIN, SUPER_ADMIN ou GERENTE (WAB) ou ADMIN/SUPER_ADMIN (resumo)

### Erro 401 no cron

- Verifique se `CRON_SECRET` está configurado no `.env`
- Verifique se o header `Authorization: Bearer <token>` está correto

### Erro 500 no cron

- Verifique logs do servidor para detalhes
- Comumente causado por falta de variáveis VAPID

---

## 📝 Checklist de Deploy

- [ ] Adicionar `CRON_SECRET` ao `.env` local
- [ ] Adicionar `CRON_SECRET` às variáveis de ambiente do Vercel
- [ ] Adicionar `APP_URL` nos secrets do GitHub
- [ ] Adicionar `CRON_SECRET` nos secrets do GitHub
- [ ] Commit e push do arquivo `.github/workflows/cron-daily-summary.yml`
- [ ] Testar via GitHub Actions → Run workflow
- [ ] Verificar logs no GitHub e Vercel
- [ ] Confirmar recebimento de notificação push

---

## 🎯 Próximos Passos (Opcionais)

1. **Horário personalizável por usuário**: Implementar lógica para ler campo `notif_horario` e disparar no horário de cada um
2. **Conteúdo avançado**: Adicionar gráficos ou detalhes extras no resumo
3. **Notificações semanais/mensais**: Expandir para outros períodos
4. **Retry logic**: Implementar retries para pushes falhos
5. **Analytics**: Rastrear taxa de entrega e abertura de notificações
