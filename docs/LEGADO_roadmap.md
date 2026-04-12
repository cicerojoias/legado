# LEGADO — Roadmap 2026
> Da sobrevivência à transformação — 12 meses para mudar o patamar da Cícero Joias.

---

## VISÃO GERAL

| Fase | Período | Foco | Status |
|------|---------|------|--------|
| 0 — Fundação | Mar/2026 | Contexto, planejamento, primeiros dados | ✅ Concluída |
| 1 — MVP Financeiro | Mar–Abr/2026 | Substituir o caderno, separar dinheiro | ✅ Concluída (Fases 1–8) |
| 2 — WhatsApp Pro | Mar/2026 | Inbox integrada, automação de mídias, webhook | 🟡 Em desenvolvimento (Fases 1–4 concluídas) |
| 3 — Operação Visível | Mai–Jun/2026 | Ordens de serviço, custos fixos, pró-labore | 🔲 |
| 3 — Crescimento | Jul–Ago/2026 | Google, Instagram, conversão WhatsApp | 🔲 |
| 4 — Inteligência | Set–Out/2026 | IA financeira, CRM, automações | 🔲 |
| 5 — Legado | Nov–Dez/2026 | Sistema completo, dobrar faturamento | 🔲 |

---

## FASE 0 — FUNDAÇÃO
### Março/2026 — Semanas 1 e 2

**Objetivo:** Entender a realidade completa antes de construir qualquer coisa.

- [x] Levantar histórico financeiro (extrato Mercado Pago 12 meses)
- [x] Mapear estrutura da empresa (lojas, equipe, serviços)
- [x] Identificar problema central: mistura de dinheiro pessoal/empresa
- [x] Criar documento de alma do projeto (LEGADO_soul.md)
- [x] Criar documento de custos fixos (LEGADO_custos_fixos.md)
- [x] Criar roadmap 2026 (LEGADO_roadmap.md)
- [x] Mapear atendimento real (LEGADO_atendimento.md)
- [x] Modelar Banco de Dados (Supabase + Prisma)
- [x] Implementar Autenticação e Middleware PIN
- [x] **WhatsApp Pro (Fase 1-4):** Inbox, Webhooks, Mídias e Gestão de Conversas

---

## FASE 1 — MVP FINANCEIRO
### Março–Abril/2026

**Objetivo:** Cícero para de usar caderno. Pela primeira vez na história da empresa, existe visibilidade financeira real.

**O que será construído:**
- Sistema Next.js + Supabase + Prisma em produção no Vercel
- Formulário mobile-first para registro de lançamentos
- Categorias: Aliança, Banho de Ouro, Conserto, Venda, Despesa Fixa, Retirada Pessoal, Outros
- Seleção de loja (JP / Santa Rita) pré-configurada por usuário
- Forma de recebimento: PIX/Mercado Pago, Ton, Espécie
- Sistema de autenticação com 3 níveis: Admin, Funcionário, Ajudante
- Dashboard admin: saldo por loja, saldo consolidado, entradas vs. saídas por dia/semana/mês
- Cadastro de custos fixos mensais

**Métricas de sucesso da Fase 1:**
- Cícero e os funcionários usando o sistema todo dia
- Zero uso do caderno de papel após 2 semanas
- Richard consegue ver o saldo real da empresa em tempo real

**Semanas:**
- Semana 1: Schema, autenticação, formulário básico de lançamento
- Semana 2: Dashboard admin, permissões por usuário, deploy Vercel
- Semana 3: Testes com Cícero, ajustes de UX mobile
- Semana 4: Cadastro de custos fixos, primeiras análises reais

---

## FASE 2 — OPERAÇÃO VISÍVEL
### Maio–Junho/2026

**Objetivo:** Com o financeiro organizado, agora organizar a operação. Nunca mais perder uma peça ou esquecer um prazo.

**O que será construído:**
- Módulo de Ordens de Serviço
  - Registro de OS: cliente, peça, serviço, valor, prazo
  - Status: Aguardando → Em andamento → Pronto → Entregue
  - Valor a receber em aberto (relatório)
- Upload de foto do caderno → Gemini extrai lançamentos automaticamente
- Definição formal do pró-labore de Cícero com base nos dados reais
- Separação bancária: conta da empresa vs. conta pessoal

**Métricas de sucesso da Fase 2:**
- Cícero sabe exatamente quanto pode retirar por mês
- Nenhuma OS perdida ou atrasada sem comunicação ao cliente
- Primeiro mês com saldo positivo registrado e confirmado

---

## FASE 3 — CRESCIMENTO
### Julho–Agosto/2026

**Objetivo:** Com a casa em ordem, começar a crescer. Mais clientes, mais visibilidade, melhor conversão.

**Ações de marketing:**
- Instagram: 1 post + 1 reel por semana (conteúdo gerado com IA)
- Google Meu Negócio: meta de 50+ avaliações reais
- WhatsApp: roteiro de resposta que aumenta conversão de orçamentos
- Reposição de estoque de relógios com caixa separado

**O que será construído no sistema:**
- Relatório de serviços mais lucrativos (qual margem real de cada categoria)
- Comparativo mês a mês de faturamento por loja
- Alerta de clientes que sumiram após orçamento (base para follow-up)

**Métricas de sucesso da Fase 3:**
- 50+ avaliações no Google
- Faturamento 20% acima da média dos últimos 12 meses
- Taxa de conversão de orçamentos melhorada

---

## FASE 4 — INTELIGÊNCIA
### Setembro–Outubro/2026

**Objetivo:** O sistema começa a ajudar a tomar decisões, não só registrar dados.

**O que será construído:**
- IA financeira: Gemini analisa histórico e gera insights mensais automáticos
  - "Outubro foi seu melhor mês nos últimos 12 — aqui está o porquê"
  - "Você gasta X% mais em energia no verão — considere isso no planejamento"
  - "Banho de ouro tem margem 3x maior que venda de produto — priorize"
- Módulo CRM básico: cadastro de clientes + histórico de compras
- Lembretes automáticos para datas especiais (aniversários de casamento de quem comprou aliança)
- Assistente de atendimento WhatsApp: Richard digita serviço + valor → Gemini gera mensagem formatada no tom da Cícero Joias
- Início do acúmulo de pares foto+preço de banho de ouro para futura estimativa automática por IA

**Métricas de sucesso da Fase 4:**
- Richard não precisa analisar planilha manualmente — o sistema conta a história
- Primeiros clientes retornando por ação de relacionamento ativo

---

## FASE 5 — LEGADO
### Novembro–Dezembro/2026

**Objetivo:** Dobrar o faturamento em relação a novembro/dezembro de 2025. Encerrar o ano com caixa positivo pela primeira vez em anos.

**O que estará pronto:**
- Sistema financeiro completo com histórico de 9 meses
- Operação totalmente registrada digitalmente
- Google com 100+ avaliações
- Instagram ativo e gerando leads
- WhatsApp com IA assistindo o atendimento
- Cícero com pró-labore definido e conta separada
- Richard com visão clara de onde o negócio está e para onde vai

**Meta financeira:**
- Novembro/2025 foi R$24.706 de entrada
- Meta novembro/2026: R$45.000+
- Dezembro/2025 foi R$39.134 de entrada
- Meta dezembro/2026: R$65.000+

---

## PRINCÍPIOS DO PROJETO LEGADO

**1. Dados antes de decisões.**
Nenhuma mudança operacional grande sem número real que a justifique.

**2. Simples primeiro, completo depois.**
O MVP não precisa ser perfeito. Precisa ser usado.

**3. Construído para Cícero, não para programadores.**
Se o pai não consegue usar no celular com facilidade, a feature está errada.

**4. Cada fase financia a próxima.**
O sistema não é custo — é investimento que gera caixa para o próximo módulo.

**5. O legado já existe. O trabalho é preservar e crescer.**
41 anos de reputação não se compra. Se usa como base de tudo.

---

*Documento criado em: março/2026 — Projeto Legado v1.0*
*Revisar e atualizar ao final de cada fase.*
