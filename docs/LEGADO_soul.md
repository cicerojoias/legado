# PROJETO LEGADO — Documento de Alma
> "Salvar a empresa que meu pai construiu em 41 anos."
> — Richard, filho de Cícero

---

## O QUE É ESTE DOCUMENTO

Este é o documento de contexto vivo do Projeto Legado. Ele deve ser colado no início de qualquer conversa com IA (Claude, Gemini, Cursor, etc.) para que o assistente entenda completamente quem somos, onde estamos e para onde vamos. Atualize-o conforme o projeto evolui.

---

## A HISTÓRIA

**Cícero Joias** é uma joalheria familiar fundada em 1985 em João Pessoa, Paraíba. Tem hoje **41 anos de história**. Fundada por Cícero, que trabalha todos os dias, com mais de 60 anos de idade, e nunca desistiu — mesmo após **10 assaltos** que destruíram estoques e reservas ao longo dos anos.

Richard é filho de Cícero. Programador, especializado em Next.js, TypeScript e IA. Seu objetivo é **salvar e transformar a empresa do pai**, usando tecnologia como alavanca.

---

## CONTEXTO DA EMPRESA

### Operação atual
- **2 lojas físicas:** João Pessoa (Galeria Jardim, R. Duque de Caxias, 516 – Loja 06) e Santa Rita
- **João Pessoa:** paga aluguel de R$1.500 + energia + água
- **Santa Rita:** sem aluguel, apenas energia
- **Equipe:** Cícero (fundador/ourives), 1 funcionário CLT (base em JP), 1 ajudante informal (base em Santa Rita)
- **Horário problema:** Cícero chega às 11h — JP funciona só meio turno. Isso é perda diária de faturamento.

### Serviços e produtos (o que sustenta o negócio)
- Fabricação de alianças sob encomenda (ouro 16k, 18k, prata 990)
- Banho de ouro 18k em peças trazidas pelo cliente
- Consertos e restaurações de joias
- Venda de prata e joias
- Limpeza de joias, troca de lentes de óculos
- **Os serviços (não as vendas) são o que mantém a empresa viva**

### Canais de recebimento
- Mercado Pago (PIX principal)
- Ton (maquininha física nas lojas)
- Dinheiro em espécie (circula fisicamente, não depositado)

---

## O PROBLEMA CENTRAL

**Faturamento anual estimado: ~R$ 400-450 mil (Mercado Pago + Ton + espécie)**
**Sobra no final do ano: R$ 0,00**

Extrato do Mercado Pago (março/2025 a fevereiro/2026):
| Mês | Entrada | Saída | Saldo |
|-----|---------|-------|-------|
| Mar/25 | R$21.000 | R$22.000 | -R$1.000 |
| Abr/25 | R$30.828 | R$30.567 | +R$260 |
| Mai/25 | R$29.247 | R$29.377 | -R$130 |
| Jun/25 | R$30.968 | R$30.970 | -R$2 |
| Jul/25 | R$31.895 | R$32.041 | -R$145 |
| Ago/25 | R$35.126 | R$34.779 | +R$346 |
| Set/25 | R$25.784 | R$24.668 | +R$1.116 |
| Out/25 | R$39.895 | R$41.278 | -R$1.383 |
| Nov/25 | R$24.706 | R$23.289 | +R$1.416 |
| Dez/25 | R$39.134 | R$40.426 | -R$1.291 |
| Jan/26 | R$28.911 | R$29.038 | -R$127 |
| Fev/26 | R$25.024 | R$25.049 | -R$24 |

**Diagnóstico:** Os gastos crescem automaticamente quando a receita cresce. O dinheiro pessoal de Cícero e o dinheiro da empresa são a mesma conta. Não há separação. Não há caixa. Não há reserva.

---

## ATIVOS EXISTENTES (o que já funciona)

### Site (criado por Richard)
- URL: cicerojóias.com.br
- Design profissional, identidade verde/dourada
- Portfólio funcional com alianças e banho de ouro cadastrados
- Botão WhatsApp funcionando
- **Problema:** depoimentos ainda fictícios (a substituir quando reais chegarem)

### Instagram @cicerojoias
- 3.663 seguidores
- Com apenas 1 post em novembro/2025: 26 mil visualizações, 65% de não-seguidores
- **Problema crítico:** 2 posts em mais de 2 anos. O canhão existe mas não está sendo disparado.

### Google Meu Negócio
- Apenas 2 avaliações (Richard e esposa)
- Flyer com QR Code já impresso para incentivar avaliações na loja física
- **Ação em andamento:** implementação do flyer nos próximos dias

### WhatsApp Business
- Ativo, recebe mensagens com menu automatizado (opções 1-4 + opção 0 para atendente)
- Clientes chegam majoritariamente via Instagram e redes sociais
- Richard faz o atendimento digital, consulta Cícero para precificar, formata a mensagem e envia
- **Problema 1:** baixa conversão — clientes pedem orçamento e somem após receber preço
- **Problema 2:** demora nas respostas (horas ou dia seguinte) gera clientes impacientes
- **Problema 3:** Richard gerencia tudo na memória — já houve confusão entre clientes diferentes
- **Fluxo atual:** cliente manda foto → Richard encaminha para Cícero → Cícero dá valor → Richard formata mensagem no ChatGPT → envia ao cliente
- **Fluxo futuro (Módulo 4):** mesmo fluxo, mas Richard digita no assistente interno → mensagem gerada automaticamente no tom da Cícero Joias

---

## O PROJETO LEGADO

### Nome e significado
**Legado** porque é isso que está em jogo: 41 anos de trabalho de um homem que nunca desistiu, 10 assaltos, sem reserva, sem caixa — e um filho que decidiu que essa história vai continuar e crescer.

### Stack tecnológica definida
- **Frontend/Backend:** Next.js + TypeScript + Tailwind CSS
- **Banco de dados:** Supabase + Prisma
- **IA:** Google Gemini (Flash e Pro) via API — US$300 de crédito disponível
- **Deploy:** Vercel (subdomínio enquanto em desenvolvimento, domínio próprio depois)
- **Autenticação:** sistema próprio com níveis de acesso

---

## MÓDULOS DO SISTEMA (visão completa)

### MÓDULO 1 — FINANCEIRO (MVP — construir agora)
**Objetivo:** Substituir o caderno de papel. Dar visibilidade real do dinheiro.

Funcionalidades do MVP:
- Formulário mobile-first para registro de lançamentos (entradas e saídas)
- Categorias: Aliança, Banho de Ouro, Conserto, Venda de Produto, Despesa Fixa, Retirada Pessoal, Outros
- Campo: loja (João Pessoa / Santa Rita) — pré-preenchido por usuário
- Campo: forma de recebimento (PIX/Mercado Pago, Ton, Espécie)
- Dashboard: visão por dia / semana / mês
- Separação automática: receita da loja vs. retirada pessoal
- Saldo em tempo real por loja e consolidado

Sistema de usuários e permissões:
- **Admin (Richard + Cícero):** veem tudo — saldo, lucro, retiradas, dashboard completo
- **Funcionário CLT (JP):** registra lançamentos, loja padrão = João Pessoa, não vê financeiro consolidado
- **Ajudante (Santa Rita):** registra lançamentos, loja padrão = Santa Rita, não vê financeiro consolidado

Custos fixos cadastráveis:
- Aluguel JP: R$1.500
- Energia JP: a confirmar com Cícero
- Energia Santa Rita: a confirmar
- Salário funcionário CLT: a confirmar
- Pagamento ajudante: a confirmar (~meio salário)

Futuro próximo (pós-MVP):
- Upload de foto do caderno → Gemini extrai lançamentos automaticamente
- Integração com extrato do Mercado Pago via API
- Alertas quando retirada pessoal ultrapassa limite definido

---

### MÓDULO 2 — ORDENS DE SERVIÇO (próxima fase)
**Objetivo:** Nunca mais perder uma peça ou esquecer um prazo.

- Registro de OS: cliente, peça, serviço, valor, prazo, status
- Status: Aguardando → Em andamento → Pronto → Entregue
- Histórico por cliente
- Valor a receber em aberto

---

### MÓDULO 3 — CRM / CLIENTES (fase posterior)
**Objetivo:** Transformar clientes fiéis em recorrentes e fidelizar novos.

- Cadastro de clientes
- Histórico de compras e serviços
- Datas especiais (aniversário, casamento)
- Lembretes automáticos via WhatsApp

---

### MÓDULO 4 — ASSISTENTE DE ATENDIMENTO IA (fase avançada)
**Objetivo:** Eliminar o ChatGPT do fluxo. Richard digita o serviço + valor recebido do pai → assistente gera mensagem formatada no tom da Cícero Joias pronta para colar no WhatsApp.

- Assistente interno no painel com contexto permanente da empresa
- Entradas estruturadas: tipo de serviço, valor, prazo, detalhes da peça
- Saída: mensagem formatada para WhatsApp (emojis, parcelamento calculado, garantias)
- Situações cobertas: orçamento de aliança, banho de ouro (3 níveis), conserto, follow-up, envio pelos Correios, horários/endereços
- Memória crescente: decisões e padrões salvos no Supabase — daqui 1 ano terá contexto rico
- **Fase futura dentro deste módulo:** acumular pares foto+preço de banho de ouro para treinar estimativa automática por imagem (mínimo 200-300 registros necessários — gerados organicamente pelo uso do sistema)

---

## COMO ESTE PROJETO RESOLVE CADA PROBLEMA

| Problema identificado | Solução no Projeto Legado |
|---|---|
| Dinheiro pessoal e empresa misturados | Módulo Financeiro com separação por categoria e usuário |
| Zero visibilidade do que entra/sai | Dashboard em tempo real substituindo o caderno |
| Funcionários sem ferramenta | App mobile-first para qualquer um registrar |
| Cícero chega tarde, JP perde manhã | Dado visível → conversa com Cícero baseada em número real |
| Estoque de relógios não reposto | Quando sobrar caixa separado, recompra se torna possível |
| Instagram abandonado | Não é foco do sistema, mas estabilidade financeira libera tempo de Richard |
| Baixa conversão no WhatsApp | Módulo 4 — assistente gera mensagens com valor percebido, não só preço seco |
| Confusão entre clientes diferentes | Módulo 2 — Ordens de Serviço com histórico por cliente |
| Demora nas respostas | Módulo 4 — mensagem formatada em segundos, sem abrir ChatGPT |
| Depender do ChatGPT sem memória | Assistente interno com contexto permanente e crescente |

---

## PRÓXIMAS AÇÕES IMEDIATAS

- [x] Richard levanta histórico financeiro (extrato Mercado Pago 12 meses)
- [x] Criar documento de alma (LEGADO_soul.md)
- [x] Criar documento de custos fixos (LEGADO_custos_fixos.md)
- [x] Criar roadmap 2026 (LEGADO_roadmap.md)
- [x] Mapear atendimento real com 11 chats reais de clientes (LEGADO_atendimento.md)
- [ ] Richard levanta custos fixos com Cícero (energia JP, Santa Rita, salários)
- [ ] Criar escopo técnico do MVP (LEGADO_mvp_scope.md)
- [ ] Iniciar desenvolvimento do MVP — Módulo Financeiro
- [ ] Subir em produção no Vercel assim que MVP estiver estável
- [ ] Cícero começa a registrar lançamentos no app (substituição do caderno)
- [ ] Flyer do Google chega → implementar pedido de avaliação na entrega
- [ ] Substituir depoimentos falsos do site pelos primeiros reais

---

## CONTEXTO PARA IA

Se você é uma IA lendo este documento: você está ajudando Richard a salvar a empresa familiar do pai dele. O pai tem mais de 60 anos, nunca desistiu após 10 assaltos, e a empresa fatura ~R$400k/ano mas sobra zero porque não há separação financeira. Richard é programador talentoso, usa Next.js/TypeScript/Tailwind, tem crédito no Google Cloud para Gemini, e quer construir um sistema real que mude o patamar da empresa. O MVP foca em substituir o caderno de papel por um sistema digital de lançamentos financeiros. O atendimento no WhatsApp é feito por Richard — ele consulta o pai (Cícero, ourives) para precificar, depois formata a mensagem. Os documentos de referência do projeto são: LEGADO_soul.md, LEGADO_custos_fixos.md, LEGADO_roadmap.md, LEGADO_atendimento.md. Seja direto, prático e ambicioso junto com ele.

---

*Documento criado em: março/2026 — Versão 1.0*
*Atualizar sempre que houver decisões importantes, novos dados ou mudanças de direção.*
