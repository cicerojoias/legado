# Guia de Configuração de Templates WhatsApp - Meta Business Manager

## 📋 Visão Geral

Este guia explica como configurar e aprovar templates de mensagem no Meta Business Manager para funcionar fora da janela de 24h do WhatsApp Business API.

---

## ⚠️ Importante: Por que os templates são necessários?

O WhatsApp Business API possui uma **janela de 24 horas** que se inicia quando um cliente envia uma mensagem. Dentro dessa janela, você pode enviar mensagens livres. Após expirar, **apenas templates pré-aprovados** podem ser enviados para reabrir a conversa.

**Fluxo atual do sistema:**
1. Cliente envia mensagem → Janela de 24h aberta
2. Você responde livremente dentro da janela
3. Após 24h sem resposta do cliente → Janela expira
4. Para continuar → Use um template aprovado
5. Cliente responde → Nova janela de 24h se abre

---

## 🔧 Passo a Passo: Criar e Aprovar Templates

### 1. Acessar o Meta Business Manager

1. Acesse: [https://business.facebook.com](https://business.facebook.com)
2. Selecione sua conta de negócio
3. No menu lateral esquerdo, clique em **WhatsApp** > **Gerenciador de Modelos** (ou **WhatsApp Manager** > **Message Templates**)

### 2. Criar um Novo Template

1. Clique no botão **Criar modelo de mensagem** (Create Message Template)
2. Preencha os campos:

#### **Nome do Template** (Template Name)
- **Regras obrigatórias:**
  - Apenas letras minúsculas
  - Underscores (_) no lugar de espaços
  - Sem caracteres especiais ou acentos
  - Exemplos válidos:
    - ✅ `retomar_atendimento`
    - ✅ `peca_pronta`
    - ✅ `orcamento_joias`
    - ❌ `Retomar Atendimento` (espaços e maiúsculas)
    - ❌ `retomar-atendimento` (hífen)
    - ❌ `retomar_atendimento!` (caractere especial)

#### **Idioma** (Language)
- Selecione **Português (Brazil)** ou **Português (BR)**
- Código: `pt_BR`

#### **Categoria** (Category)
- Escolha uma das opções:
  - **Utilidade** (Utility) - Para atualizações de serviço, confirmações
  - **Marketing** - Para promoções, novidades
  - **Autenticação** - Para códigos de verificação (OTP)

**Recomendação para Cícero Joias:** Use **Utilidade** para templates de atendimento.

#### **Conteúdo do Template** (Template Content)

**Exemplo 1: Retomar Atendimento**
```
Olá {{1}}! 👋

Notamos que não concluímos seu atendimento na Cícero Joias.

{{2}}

✅ Responda esta mensagem para continuarmos!

Estamos à disposição. 😊
```

**Variáveis:**
- `{{1}}` = Nome do cliente
- `{{2}}` = Mensagem personalizada (ex: contexto do atendimento)

**Regras de conteúdo:**
- ✅ Emojis são permitidos
- ✅ Quebras de linha são permitidas
- ❌ Links não são permitidos no corpo
- ❌ Texto excessivamente promocional
- ❌ ALL CAPS (todas maiúsculas)
- ❌ Saudações genéricas demais

### 3. Enviar para Aprovação

1. Revise o template
2. Clique em **Enviar para aprovação** (Submit for Approval)
3. Aguarde a aprovação (geralmente instantânea a 24 horas)

### 4. Verificar Status do Template

- **Aprovado** (Approved) ✅ - Pode ser usado imediatamente
- **Pendente** (Pending) ⏳ - Aguardando revisão da Meta
- **Rejeitado** (Rejected) ❌ - Precisa de ajustes (veja o motivo)
- **Pausado** (Paused) ⏸️ - Desativado temporariamente
- **Desativado** (Disabled) 🚫 - Removido permanentemente

---

## 📝 Templates Necessários para o Sistema

O sistema está configurado com **4 templates**. Configure todos no Meta Business Manager:

### Template 1: boas_vindas_cicero
- **Nome:** `boas_vindas_cicero`
- **Categoria:** Utilidade
- **Idioma:** pt_BR
- **Conteúdo:**
```
Olá, seja bem-vindo(a) à Cícero Joias! ✨

Temos 40 anos de tradição em:

1️⃣ Alianças, anéis de formatura e joias sob medida 💍
2️⃣ Banho de ouro premium 🔸
3️⃣ Joias em geral, relógios e armações de óculos 💎
4️⃣ Consertos profissionais de joias, relógios e óculos 🔧

0️⃣ Falar com um atendente 👥

Digite o número da opção desejada e aguarde.

Em breve entraremos em contato! ☺️
```

### Template 2: retomar_atendimento ⭐ **MAIS IMPORTANTE**
- **Nome:** `retomar_atendimento`
- **Categoria:** Utilidade
- **Idioma:** pt_BR
- **Conteúdo:**
```
Olá {{1}}! 👋

Notamos que não concluímos seu atendimento na Cícero Joias.

{{2}}

✅ Responda esta mensagem para continuarmos!

Estamos à disposição. 😊
```

### Template 3: peca_pronta
- **Nome:** `peca_pronta`
- **Categoria:** Utilidade
- **Idioma:** pt_BR
- **Conteúdo:**
```
Olá {{1}}, sua peça já está pronta! Pode passar em nossa loja para retirar. 😊
```

### Template 4: orcamento_joias
- **Nome:** `orcamento_joias`
- **Categoria:** Utilidade
- **Idioma:** pt_BR
- **Conteúdo:**
```
Olá {{1}}, segue o orçamento solicitado: {{2}}. Qualquer dúvida, estamos à disposição!
```

---

##  Testar Templates

### Método 1: Via Meta Business Manager
1. No Gerenciador de Modelos, encontre o template aprovado
2. Clique nos **três pontos** (⋮) ao lado do template
3. Selecione **Enviar mensagem de teste** (Send Test Message)
4. Insira seu número de telefone (com código do país, ex: 5511999999999)
5. Envie e verifique se recebeu

### Método 2: Via Sistema (Recomendado)
1. Abra uma conversa no inbox que está fora da janela de 24h
2. O componente **TemplateSelector** será exibido automaticamente
3. Expanda o template desejado
4. Preencha os campos obrigatórios
5. Clique em **Enviar Template**
6. Verifique:
   - ✅ Toast de sucesso
   - ✅ Mensagem aparece no chat
   - ✅ Cliente recebe no WhatsApp

---

## 🔍 Solução de Problemas

### Erro: "Template não está disponível ou não foi aprovado pela Meta"

**Causas possíveis:**
1. ❌ Template não foi criado no Meta Business Manager
2. ⏳ Template ainda está em revisão (status: Pendente)
3. ❌ Template foi rejeitado (verifique o motivo)
4. 📝 Nome do template não corresponde exatamente (case-sensitive)

**Solução:**
1. Acesse Meta Business Manager > WhatsApp > Gerenciador de Modelos
2. Verifique se o template existe e está com status **Aprovado**
3. Confirme que o nome está **exatamente igual** ao configurado no código
4. Se rejeitado, ajuste o conteúdo e reenvie

### Erro: "Meta API error 400"

**Causas comuns:**
- ❌ Parâmetros incorretos (número faltando, formato errado)
- ❌ Template com status diferente de "Aprovado"
- ❌ Variáveis não preenchidas corretamente
- ❌ Token de acesso expirado ou inválido

**Solução:**
1. Verifique os logs no console do navegador (F12)
2. Confira se todos os campos foram preenchidos
3. Valide que o número do contato está no formato correto
4. Teste o template manualmente pelo Meta Business Manager

### Template aparece como inválido no TemplateSelector

**Indicador visual:** Ícone ❌ vermelho ao lado do nome do template

**Solução:**
1. Passe o mouse sobre o ícone de alerta para ver detalhes
2. Expanda o template para ver a mensagem de erro
3. Siga as instruções para corrigir no Meta Business Manager
4. Recarregue a página para revalidar

---

## 📊 Monitoramento e Métricas

### Verificar Uso dos Templates
1. Meta Business Manager > WhatsApp > Gerenciador de Modelos
2. Clique em um template aprovado
3. Visualize métricas:
   - Mensagens enviadas
   - Taxa de entrega
   - Taxa de leitura
   - Bloqueios/reclamações

### Boas Práticas
- ✅ Monitore a taxa de bloqueio (deve ser < 1%)
- ✅ Alterne templates para evitar fadiga
- ✅ Personalize mensagens com variáveis
- ✅ Use linguagem clara e direta
- ❌ Não envie spam ou mensagens irrelevantes

---

## 🚀 Próximos Passos

1. **Criar todos os 4 templates** no Meta Business Manager
2. **Aguardar aprovação** (pode levar até 24h)
3. **Testar cada template** via Meta e via sistema
4. **Treinar a equipe** no uso do TemplateSelector
5. **Monitorar métricas** semanalmente

---

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no console (F12 > Console)
2. Confira o status dos templates no Meta Business Manager
3. Revise este guia para garantir conformidade
4. Consulte a [documentação oficial da Meta](https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates)

---

## ✅ Checklist de Validação

Antes de usar em produção, confirme:

- [ ] Todos os 4 templates criados no Meta Business Manager
- [ ] Todos com status **Aprovado**
- [ ] Nomes correspondem exatamente ao código (lowercase, underscore)
- [ ] Idioma configurado como **pt_BR**
- [ ] Teste manual via Meta Business Manager funcionou
- [ ] Teste via sistema (TemplateSelector) funcionou
- [ ] Equipe treinada no uso do sistema
- [ ] Monitoramento de métricas configurado
