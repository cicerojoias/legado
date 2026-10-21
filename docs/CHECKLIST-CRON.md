# 🚀 Configuração Rápida - GitHub Actions Cron

## ⏱️ Tempo necessário: 5 minutos

---

## 1️⃣ Adicionar Secrets no GitHub (2 min)

Acesse: `https://github.com/[seu-usuario]/[seu-repo]/settings/secrets/actions`

### Secret 1:
- **Name**: `APP_URL`
- **Value**: `https://legadocicerojoias.vercel.app` (sua URL do Vercel)

### Secret 2:
- **Name**: `CRON_SECRET`  
- **Value**: `744c709d5ab240cfca8d24d97b526ef78501db9bc06bab14b7b96620fffe6305`

> ⚠️ **Importante**: O `CRON_SECRET` deve ser **exatamente o mesmo** do arquivo `.env.local`

---

## 2️⃣ Configurar no Vercel (1 min)

1. Acesse: `https://vercel.com/dashboard`
2. Clique no seu projeto `legado-cicero-joias`
3. Vá em **Settings** → **Environment Variables**
4. Adicione:
   - **Key**: `CRON_SECRET`
   - **Value**: `744c709d5ab240cfca8d24d97b526ef78501db9bc06bab14b7b96620fffe6305`
5. Clique em **Save**

---

## 3️⃣ Commit e Push (1 min)

```bash
git add .
git commit -m "feat: add GitHub Actions cron for daily summary"
git push origin main
```

---

## 4️⃣ Testar Imediatamente (1 min)

1. Acesse: `https://github.com/[seu-usuario]/[seu-repo]/actions`
2. Clique em **Daily Financial Summary Cron**
3. Clique em **Run workflow** → **Run workflow**
4. Aguarde 10-30 segundos
5. Veja o status: ✅ verde = sucesso, ❌ vermelho = falha

---

## ✅ Verificar se Funcionou

### No GitHub:
- Workflow deve mostrar ✅ e logs como:
  ```
  ✅ Resumo diário enviado com sucesso!
  [push-dispatcher] Resumo diário enviado com sucesso para X usuário(s)
  ```

### No Vercel:
- Logs: `https://vercel.com/[seu-projeto]/logs`
- Procure por: `[cron/daily-summary]`

### No celular/navegador:
- Notificação push: "📊 Resumo Financeiro do Dia"

---

## ❌ Falhou? Verifique:

1. **Secrets configurados corretamente?**
   - APP_URL = URL do seu site (sem barra no final)
   - CRON_SECRET = mesmo valor do `.env.local`

2. **Variável CRON_SECRET no Vercel?**
   - Deve estar em Settings → Environment Variables
   - Deve ser igual ao do GitHub

3. **Redeploy após adicionar variável?**
   - Vá em **Deployments** → clique no último → **Redeploy**

4. **Usuários com subscriptions ativas?**
   ```sql
   SELECT count(*) FROM "WaPushSubscription";
   ```

---

## 📝 Ajustar Horário (Opcional)

**Horário atual**: 18:00 UTC = **15:00 BRT** (3h da tarde)

**Para executar às 18h BRT**:

Abra `.github/workflows/cron-daily-summary.yml` e mude:
```yaml
schedule:
  - cron: '0 21 * * *'  # 21:00 UTC = 18:00 BRT
```

Commit e push novamente.

---

## 🎉 Pronto!

Seu cron job vai executar automaticamente todos os dias no horário configurado.

Para testar novamente a qualquer momento:
- **GitHub** → Actions → Run workflow

---

**Documentação completa**: `docs/notificacoes-guia.md`
**Guia detalhado**: `docs/github-actions-cron-setup.md`
