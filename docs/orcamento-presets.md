# Módulo de Presets de Orçamento — Cícero Joias

Documentação do módulo de mensagens pré-formatadas para orçamentos, acessível dentro de qualquer chat do WAB inbox.

---

## Fluxo

1. Usuário abre um chat no inbox
2. Clica no ícone 📋 (Receipt) no header do chat
3. Seleciona o tipo de orçamento
4. Preenche os campos variáveis
5. Vê a prévia da mensagem renderizada
6. Clica em "Inserir no Chat" → texto vai direto para o textarea do MessageInput
7. Revisa e aperta Enviar

---

## Tipos disponíveis

| Tipo            | Status     | Campos variáveis |
|-----------------|------------|------------------|
| Banho de Ouro   | ✅ Ativo   | Nome da peça, Básico, Intermediário, Avançado |
| Aliança         | 🔜 Em breve | — |
| Conserto        | 🔜 Em breve | — |
| Formatura       | 🔜 Em breve | — |
| Orçamento Geral | 🔜 Em breve | — |

---

## Template: Banho de Ouro

### Campos de entrada
| Campo | Tipo | Observação |
|-------|------|------------|
| Nome da peça | Texto | Ex: Cordão, Anel, Aliança |
| Valor Básico (à vista) | Número | Parcela calculada automaticamente |
| Valor Intermediário (à vista) | Número | Parcela calculada automaticamente |
| Valor Avançado (à vista) | Número | Parcela calculada automaticamente |

### Cálculo de parcelas
```
parcela = Math.ceil(valor / 6 * 100) / 100
```
Arredonda centavo para cima, garantindo que 6x * parcela ≥ valor à vista.

### Template completo
```
✨ *Banho de Ouro Premium - Cícero Joias*

💎 *Peça:* {NOME_DA_PECA} (Modelo da Foto)

🥉 *Básico – 5 milésimos – sem garantia*
(R$ {VALOR_BASICO} à vista ou 6x de R$ {PARCELA_BASICO} sem juros)

🥈 *Intermediário – 10 milésimos – garantia de 6 meses*
(R$ {VALOR_INTERMEDIARIO} à vista ou 6x de R$ {PARCELA_INTERMEDIARIO} sem juros)

🥇 *Avançado – 20 milésimos – garantia de 1 ano*
(R$ {VALOR_AVANCADO} à vista ou 6x de R$ {PARCELA_AVANCADO} sem juros)

🧪 *Processo completo* com limpeza técnica, desengorduramento, preparação da peça e aplicação profissional das camadas para melhor fixação do ouro.

⏳ *Prazo de serviço:* até 14 dias úteis.

🔒 *Garantia:* refere-se exclusivamente a defeitos de aplicação do banho.
Não cobre mau uso, riscos, atritos constantes ou desgaste natural da camada.
```

---

## Como adicionar um novo tipo

1. **Definir o tipo** em `OrcamentoModal.tsx`:
   - Adicionar entrada em `TYPES` com `available: true`
   - Criar função `buildNomeTipo(campos...) → string` com o template

2. **Adicionar o formulário** no bloco `{selectedType === 'novo-tipo' && ...}` dentro do corpo do modal

3. **Atualizar a tabela** neste arquivo

4. **Bump de versão** em `perfil-content.tsx`

---

## Arquitetura técnica

```
InsertTextContext (contexto compartilhado)
  ├── ContactHeader → OrcamentoModal → chama requestInsert(texto)
  └── MessageInput → consome pendingText → injeta no textarea
```

O contexto `InsertTextProvider` fica em `[conversationId]/page.tsx` envolvendo
`SelectionProvider`, `ContactHeader` e `ChatWindow`.
