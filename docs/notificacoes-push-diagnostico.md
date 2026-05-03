# 🔔 Guia de Diagnóstico - Notificações Push PWA

## ✅ Correções Implementadas

### 1. **Service Worker Corrigido**
- ✅ Removido conflito entre `sw.js` e `sw.ts`
- ✅ O Serwist agora gerencia automaticamente o registro do service worker
- ✅ Arquivo `sw.ts` contém todos os handlers (push, notificationclick, daily-summary)
- ✅ Componente `pwa-register.tsx` removido (não é necessário com Serwist)

### 2. **Logging Aprimorado**
- ✅ Logs detalhados no `push-dispatcher.ts` para debug
- ✅ Contagem de sucesso/falha em cada envio
- ✅ Mensagens de erro específicas para facilitar diagnóstico
- ✅ Log de payloads enviados

### 3. **Variáveis de Ambiente**
- ✅ VAPID configurado corretamente no `.env`
  - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT`

---

## 🔍 Como Verificar se as Notificações Estão Funcionando

### Passo 1: Verificar Registro do Service Worker

1. Abra o app em produção (ou build local: `npm run build && npm start`)
2. Abra DevTools → Application → Service Workers
3. Deve mostrar `/sw.js` com status "Activated and is running"
4. Clique em "Update on reload" para garantir que está usando a versão mais recente

### Passo 2: Verificar Permissão de Notificação

No console do browser (F12):
```javascript
Notification.permission
// Deve retornar "granted"
```

Se retornar "default" ou "denied":
- Vá para Perfil → Notificações Push
- Clique em "Ativar Notificações"
- Aceite a permissão no navegador

### Passo 3: Verificar Subscription no Banco

Execute no banco de dados:
```sql
-- Ver subscriptions ativas
SELECT 
  s.id,
  s.endpoint,
  u.nome,
  u.role,
  u.notif_push,
  u.ativo,
  s."createdAt"
FROM "wa_push_subscriptions" s
JOIN "User" u ON s."userId" = u.id
ORDER BY s."createdAt" DESC;
```

**Deve retornar pelo menos 1 linha** para o usuário logado.

Se não retornar:
1. Vá para Perfil → Notificações Push
2. Desative e reative as notificações
3. Verifique novamente

### Passo 4: Verificar Configurações do Usuário

```sql
-- Verificar se o usuário pode receber notificações
SELECT 
  id,
  nome,
  role,
  notif_push,
  ativo
FROM "User"
WHERE role IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE');
```

**Requisitos:**
- `role` deve ser `ADMIN`, `SUPER_ADMIN` ou `GERENTE`
- `ativo` deve ser `true`
- `notif_push` deve ser `true`

### Passo 5: Testar Envio de Notificação WAB

1. Envie uma mensagem para o WhatsApp Business
2. Monitore os logs do servidor (Vercel ou terminal local)
3. Procure por:

```
[push-dispatcher] Iniciando envio para conversa <ID>
[push-dispatcher] Encontradas X subscriptions elegíveis
[push-dispatcher] Enviando push para X dispositivo(s)
[push-dispatcher] Payload: {"title":"...","body":"...","conversationId":"..."}
[push-dispatcher] Resultado: X sucesso(s), 0 falha(s)
```

**Se mostrar "0 subscriptions elegíveis":**
- Verifique o Passo 3 e 4
- Confirme que o usuário tem subscription no banco
- Confirme que `notif_push = true`

### Passo 6: Verificar Service Worker Recebendo Push

No DevTools do browser:
1. Vá para Application → Service Workers
2. Clique em "Inspect" no service worker
3. No console do SW, procure por:

```
[push] Notificação recebida
```

Se não aparecer, o push não está chegando ao browser.

### Passo 7: Testar Resumo Diário Manualmente

**Em desenvolvimento:**
```bash
curl -X POST http://localhost:3000/api/cron/daily-summary \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

**Em produção:**
```bash
curl -X POST https://<SEU_DOMINIO>.vercel.app/api/cron/daily-summary \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json"
```

**Logs esperados:**
```
[cron/daily-summary] Iniciando envio de resumo diário
[push-dispatcher] Iniciando envio de resumo diário
[push-dispatcher] Enviando resumo diário para X usuário(s)
[push-dispatcher] Payload: {"title":"📊 Resumo Financeiro do Dia","body":"..."}
[push-dispatcher] Resumo diário: X sucesso(s), 0 falha(s)
[push-dispatcher] Resumo diário enviado com sucesso para X usuário(s)
```

---

## 🐛 Problemas Comuns e Soluções

### Notificações não aparecem no dispositivo

**Sintoma:** Push é enviado mas não aparece na barra de notificações

**Causas possíveis:**
1. **Service worker antigo registrado**
   - Solução: Abra DevTools → Application → Service Workers → "Unregister" → recarregue a página
   
2. **Permissão negada**
   - Solução: Verifique `Notification.permission` no console. Se "denied", redefina nas configurações do browser

3. **App em primeiro plano na conversa**
   - Comportamento esperado: Notificações são suprimidas se a conversa já está visível
   - Verifique se o badge do app está atualizado (número no ícone)

4. **Browser não suporta Web Push**
   - Solução: Use Chrome, Edge, Firefox ou Safari atualizado

### Subscription não é registrada no banco

**Sintoma:** Tabela `wa_push_subscriptions` vazia

**Causas possíveis:**
1. **Usuário não ativou notificações**
   - Solução: Vá para Perfil → Notificações Push → Ative

2. **Erro na API de subscription**
   - Verifique logs do browser por erros em `/api/whatsapp/push-subscribe`
   - Verifique se o usuário está autenticado
   - Verifique se o role não é OPERADOR (não tem permissão)

3. **VAPID não configurado**
   - Verifique `.env` com as 3 variáveis VAPID
   - Execute `npm run build` após alterar variáveis

### Erro 410 Gone ou 404 Not Found

**Sintoma:** Logs mostram `410` ou `404` no push-dispatcher

**Causa:** Subscription expirou (usuário limpou dados do browser, desinstalou PWA, etc.)

**Solução:** O sistema já limpa automaticamente subscriptions expiradas. O usuário precisa reativar notificações no Perfil.

### Notificações funcionam em desenvolvimento mas não em produção

**Causas possíveis:**
1. **Variáveis VAPID não configuradas no Vercel**
   - Vá para Vercel → Project Settings → Environment Variables
   - Adicione as 3 variáveis VAPID
   - Faça deploy novamente

2. **Service worker não atualizado**
   - Force refresh: Ctrl+Shift+R (Windows) ou Cmd+Shift+R (Mac)
   - Ou unregister em DevTools → Application → Service Workers

3. **HTTPS obrigatório**
   - Web Push requer HTTPS em produção
   - Vercel fornece HTTPS automaticamente

### Resumo diário não é enviado

**Sintoma:** Cron job executa mas notificações não chegam

**Verificações:**
1. **Cron job está configurado?**
   - Verifique `.github/workflows/cron-daily-summary.yml` ou `vercel.json`
   - Verifique se `CRON_SECRET` está configurado

2. **Usuários elegíveis?**
   ```sql
   SELECT id, nome, role, notif_push, ativo
   FROM "User"
   WHERE role IN ('ADMIN', 'SUPER_ADMIN')
     AND ativo = true
     AND notif_push = true;
   ```

3. **Logs do cron job:**
   - GitHub Actions: Verifique a aba "Actions" no repositório
   - Vercel: Verifique logs da função serverless

---

## 🧪 Teste Completo End-to-End

### Cenário 1: Notificação WAB em Tempo Real

1. **Preparação:**
   - Login como ADMIN/SUPER_ADMIN/GERENTE
   - Ative notificações no Perfil
   - Feche o app ou navegue para outra página (não Inbox)

2. **Teste:**
   - Envie mensagem para WhatsApp Business
   - Aguarde até 10 segundos

3. **Verificação:**
   - ✅ Notificação aparece na barra de notificações
   - ✅ Título = nome do contato
   - ✅ Corpo = conteúdo da mensagem
   - ✅ Clique na notificação abre a conversa específica

4. **Logs esperados:**
   ```
   [webhook] Processando mensagem de <nome>
   [push-dispatcher] Iniciando envio para conversa <ID>
   [push-dispatcher] Encontradas 1 subscriptions elegíveis
   [push-dispatcher] Enviando push para 1 dispositivo(s)
   [push-dispatcher] Payload: {"title":"João","body":"Olá, gostaria de saber...",...}
   [push-dispatcher] Resultado: 1 sucesso(s), 0 falha(s)
   ```

### Cenário 2: Resumo Diário às 18h

1. **Preparação:**
   - Login como ADMIN/SUPER_ADMIN
   - Ative notificações no Perfil
   - Registre alguns lançamentos financeiros no dia

2. **Teste Manual:**
   ```bash
   curl -X POST http://localhost:3000/api/cron/daily-summary \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```

3. **Verificação:**
   - ✅ Notificação aparece com título "📊 Resumo Financeiro do Dia"
   - ✅ Corpo mostra Entradas, Saídas e Saldo
   - ✅ Clique redireciona para `/hoje`

4. **Logs esperados:**
   ```
   [cron/daily-summary] Iniciando envio de resumo diário
   [push-dispatcher] Iniciando envio de resumo diário
   [push-dispatcher] Enviando resumo diário para 1 usuário(s)
   [push-dispatcher] Payload: {"title":"📊 Resumo Financeiro do Dia","body":"Entradas: R$ 1.000,00..."}
   [push-dispatcher] Resumo diário: 1 sucesso(s), 0 falha(s)
   ```

---

## 📊 Monitoramento Contínuo

### Queries Úteis para Monitoramento

```sql
-- Total de subscriptions ativas por role
SELECT 
  u.role,
  COUNT(s.id) as subscriptions_ativas
FROM "wa_push_subscriptions" s
JOIN "User" u ON s."userId" = u.id
GROUP BY u.role;

-- Usuários elegíveis sem subscription
SELECT 
  id,
  nome,
  role,
  notif_push
FROM "User"
WHERE role IN ('ADMIN', 'SUPER_ADMIN', 'GERENTE')
  AND ativo = true
  AND notif_push = true
  AND id NOT IN (SELECT "userId" FROM "wa_push_subscriptions");

-- Subscriptions antigas (> 30 dias, podem estar expiradas)
SELECT 
  s.endpoint,
  u.nome,
  s."createdAt"
FROM "wa_push_subscriptions" s
JOIN "User" u ON s."userId" = u.id
WHERE s."createdAt" < NOW() - INTERVAL '30 days';
```

### Logs para Monitorar

Configure alerts para estes logs:
- `[push-dispatcher] 0 subscriptions elegíveis` → Possível problema de registro
- `[push-dispatcher] X falha(s)` → Erros de entrega
- `[push-client] VAPID env vars não configuradas` → Erro de configuração
- `[webhook] push dispatch error` → Erro durante envio

---

## 🎯 Checklist Final

- [x] Service worker registrado corretamente (`/sw.js` compilado do `sw.ts`)
- [x] Componente `pwa-register.tsx` removido
- [x] Logging detalhado adicionado ao push-dispatcher
- [x] Variáveis VAPID configuradas no `.env`
- [ ] Variáveis VAPID configuradas no Vercel (produção)
- [ ] `CRON_SECRET` configurado no Vercel
- [ ] GitHub Actions configurado (ou Vercel Cron)
- [ ] Teste de notificação WAB passou
- [ ] Teste de resumo diário passou
- [ ] Clique na notificação redireciona corretamente
- [ ] Badge do app atualiza corretamente

---

## 📞 Suporte

Se após seguir todos os passos as notificações ainda não funcionarem:

1. Cole os logs completos do servidor
2. Cole o output das queries SQL de verificação
3. Informe browser e versão
4. Informe se é PWA instalado ou browser

Com essas informações, o diagnóstico será mais rápido e preciso.
