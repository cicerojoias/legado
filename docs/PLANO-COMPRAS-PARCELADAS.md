# Compras no cartão e parcelamento

Status (12/11/2026): implementado e publicado na v0.19.0. Visual e organização aprovados em 11/11/2026; regras operacionais fechadas (seção "Decisões fechadas"); banco aplicado com backup verificado. Veja "Andamento da implementação".

## Contexto verificado

- A saída hoje oferece PIX e espécie (`src/lib/financeiro/metodos-pgto.ts`).
- `Lancamento` tem um valor, uma data de referência e método de pagamento; não possui compra agrupadora, parcelas ou situação de pagamento.
- Relatórios somam todos os lançamentos ativos do período. Inserir previsões como lançamentos comuns faria esses valores entrarem no saldo sem confirmação de saída.
- Observações já existem no formulário, mas são concatenadas à descrição no servidor. Informações de cartão precisam de campos próprios se forem usadas em filtros e agrupamentos.

## Pedido do usuário

- Permitir cartão de crédito nas saídas, inclusive compras parceladas.
- Registrar o total e mostrar o valor de cada parcela nos meses seguintes, sem precisar repetir o cadastro.
- Identificar de quem é o cartão, banco e bandeira; permitir cartões de pessoas que não são usuários do sistema.
- Manter o controle simples, sem pressupor um módulo completo de faturas.
- Apresentar a proposta e retornar ao usuário antes de implementar: concluído com a aprovação dos prints. LLM Council foi sugerido como recurso opcional para dúvidas relevantes e não foi executado nesta discussão.
- Na implementação, manter ao máximo a identidade visual existente para que o recurso pareça nativo do app. Reutilizar componentes, formulários, modais, navegação, tipografia, cores, espaçamentos e padrões atuais. Os prints aprovam a organização e o fluxo; não exigem copiar estilos próprios do protótipo.

## Fluxo aprovado e regras ainda em aberto

Fluxo apresentado e aprovado nos prints: compra gera parcelas futuras em **A pagar**; cada parcela só entra nas saídas realizadas quando alguém confirma o pagamento, informando a data efetiva. O vencimento por si só não confirma pagamento. A compra total é informativa e não deve ser somada novamente às parcelas. Na proposta discutida, a tela Hoje também sinaliza vencimentos e leva a A pagar; esse aviso não foi representado nos prints.

Ainda é necessário definir regras operacionais: primeira data e meses sem o dia escolhido; distribuição de centavos; edição/cancelamento de compra e parcelas; pagamentos parciais ou divergentes; limites de alteração após confirmação. No cartão de terceiros, confirmar como registrar reembolso em data/valor diferente da parcela. Não transformar esses pontos em nova discussão sobre a organização visual já aprovada.

## Decisões fechadas (regras operacionais)

1. **Datas (11/11/2026):** cada vencimento = mesmo dia do primeiro vencimento no mês da parcela; se o mês for mais curto, usa o último dia dele. Calculado sempre a partir do dia original (31/01 → 28/02 → 31/03 → 30/04), nunca encadeado na parcela anterior. A data de cada parcela pode ser editada depois.
2. **Centavos (11/11/2026):** divisão em centavos inteiros; a sobra vai para a primeira parcela (100,00 em 3× = 33,34 + 33,33 + 33,33). Parcelas podem ser ajustadas à mão, com aviso se a soma não bater com o total.
3. **Edição e cancelamento (11/11/2026):** parcelas pendentes podem ter valor e data editados; a compra pode ser cancelada (encerra só as pendentes, mantém as pagas). Parcelas pagas ficam travadas; correção de parcela paga é feita no lançamento realizado, sob a trava de 24 h (ADR-0002). Exclusão lógica e log de auditoria em tudo.
4. **Valor confirmado (11/11/2026):** confirmar pagamento só aceita o valor exato da parcela. Diferença (juros, desconto, pagamento menor) exige editar a parcela pendente antes de confirmar. Sem pagamento parcial nem saldo por parcela. O valor, a data efetiva, a forma de desembolso e a observação ficam no realizado.
5. **Cartão de terceiros e reembolso (12/11/2026):** a devolução ao titular é a própria confirmação de pagamento da parcela (sem segundo estado de reembolso). Em A pagar, resumo/filtro por titular mostrando quanto está pendente em cada cartão, só informativo, sem controle de devolução.
6. **Permissão (12/11/2026):** a área de compras no cartão/parceladas (cadastrar compra, aba A pagar, editar, cancelar, confirmar pagamento, aviso de vencimentos na tela Hoje) é só para ADMIN e SUPER_ADMIN. GERENTE e OPERADOR não veem nem acessam. Valida no servidor (role vindo do banco), não só na interface. A aba Realizados continua como hoje (GERENTE+); parcelas confirmadas aparecem nela como saídas comuns.

## Banco: aplicado em produção (12/11/2026)

Com ok do usuário: backup `Documentos\Cícero Joias\Backups\cicero-joias-public-20261112-antes-compras-parceladas.dump` (14 tabelas), restaurado em Postgres temporário local com contagens idênticas à produção (lancamentos 3.447). SQL ensaiado na cópia e aplicado em produção numa transação: `prisma/sql/compras-parceladas.sql` (tabelas `compras_parceladas` e `parcelas_compra`, só aditivo, mais RLS ligado e sem acesso do anon/authenticated). Conferido: RLS ativo nas duas, 0 grants públicos, `lancamentos` intacto. Rollback: `drop table parcelas_compra, compras_parceladas;` (estão vazias até o módulo ser usado). Ao criar tabelas novas no futuro, repetir RLS (ver CLAUDE.md).

## Andamento da implementação (12/11/2026)

- ✅ Etapa 2 — modelo de dados (`prisma/schema.prisma`) e SQL aplicado em produção (acima).
- ✅ Etapa 3 — `src/lib/financeiro/parcelas.ts` (centavos, datas) + teste local `scripts/test-parcelas.ts` (a pasta `scripts/` é ignorada pelo git).
- ✅ Etapa 4 — núcleo `src/lib/financeiro/compras-core.ts` (criar, editar parcela, cancelar, confirmar) e wrappers `src/app/(protected)/lancamentos/compras-actions.ts` (só ADMIN+, papel do banco). Teste de integração local `scripts/test-compras-core.ts` contra Postgres descartável: 11 cenários OK (soma exata, ajuste de fim de mês, confirmação duplicada e simultânea gera 1 lançamento, edição só pendente, cancelamento mantém pagas, loja única presa à própria loja, previsão não entra na soma de realizados). `@unique` em `parcelas_compra.lancamento_id` confirmado no banco.
- Lançamento nascido de parcela paga: **excluir** (janela de 24h) desfaz o pagamento e a parcela volta a "A pagar"; **editar** é bloqueado (`PARCELA_VINCULADA`), para manter o valor igual ao da parcela. Mudança em `hoje/actions.ts`; ainda não testada ponta a ponta (depende de login), conferir na etapa de interface.
- A checagem de papel (ADMIN+) fica em `compras-actions.ts` e não é coberta pelo teste do núcleo; revisar na verificação final.
- ✅ Etapa 5 — interface em `/lancamentos` (só ADMIN+ vê a aba; `?aba=a-pagar` é ignorado para os demais): `a-pagar-content.tsx` (servidor), `a-pagar-view.tsx`, `compra-cartao-modal.tsx` (cadastro com prévia pelo mesmo cálculo do servidor), `confirmar-pagamento-modal.tsx`, `compra-detalhe-modal.tsx` (ver compra, editar parcela pendente, cancelar compra, aviso se a soma não bate com o total). Reaproveita Dialog, Input, Select, Button, Card e o cabeçalho verde do `LancamentoModal`; categorias e máscara de valor foram extraídas para `src/lib/financeiro/categorias.ts` e `moeda.ts` e o modal existente passou a importá-las. Parcelas atrasadas aparecem num bloco próprio em qualquer mês, para não sumirem ao navegar. Resumo por cartão é só consulta. `tsc`, lint e `npm run build` OK. Teste manual na tela fica com o usuário.
- ✅ Etapa 6 — aviso em Hoje (`aviso-vencimentos.tsx`, só ADMIN+): cartão discreto "N parcelas no cartão para pagar" (vencem hoje / atrasadas) com link para A pagar; some quando não há nada e não mexe nos totais do dia.
- ✅ Etapa 7 — revisão final (12/11/2026): corrigido limite de valor (Decimal(10,2), R$ 99.999.999,99) na validação; testes unitário (12) e de integração (11, Postgres local) OK; `tsc` OK; lint do projeto sem erro novo (restam os antigos do inbox e `prefer-const` do `createLancamento`); build OK. Versão 0.19.0 + changelog no Perfil. Relatórios/dashboard só leem `Lancamento` (nada lê parcela), então previsões não os contaminam.
- Pendente de teste manual com login real (feito pelo usuário): papel ADMIN+ vs GERENTE/OPERADOR na tela, exclusão em 24h desfazendo a parcela, fluxo completo cadastrar → confirmar → Realizados.
- Fora do escopo desta entrega: entrada "crédito" direto no botão Registrar (o cadastro fica em Lançamentos → A pagar → "+"); pagamentos parciais; reembolso como segundo estado.

## Premissas propostas, ainda não aprovadas

Uso pelo celular, volume das duas lojas e permissões atuais; geração de parcelas sem duplicação e com soma exata em centavos; sem dependência de consulta a banco/cartão ou processamento mensal externo. Cadastro identificador de cartão sem número completo, validade ou código de segurança. Manutenção no projeto existente.

## Prévia visual aprovada

O usuário autorizou criar uma tela de exemplo e receber prints antes de decidir pela implementação; aprovou o resultado e pediu máxima integração com o estilo atual do app. A proposta usa as abas **Realizados / A pagar** dentro de Lançamentos, filtro mensal, parcelas agendadas e botão **Confirmar pagamento** em cada parcela. O cadastro mostra total, quantidade de parcelas, primeiro vencimento, categoria e cartão utilizado; outro cartão permite informar titular, banco e bandeira. A confirmação mostra valor pago, data, forma de desembolso e observação. O fluxo geral está aprovado; regras operacionais não definidas continuam em aberto.

Artefatos fora do repositório, preservados em PNG original (860 × 2080 pixels), na pasta `C:\Users\joalh\Documentos\Cícero Joias\Design System\Parcelamento`:

- `index.html` e fonte Geist local: protótipo independente com dados fictícios.
- `01-a-pagar.png`: previsão mensal e parcelas pendentes.
- `02-cadastrar-compra.png`: total da compra, parcelas e cartão.
- `03-confirmar-pagamento.png`: janela de confirmação de pagamento.
- `04-pagamento-realizado.png`: exemplo após confirmar, em Realizados.
- `verificacao.json`: verificações executadas na prévia.

A captura foi feita com Chrome isolado via DevTools Protocol: Playwright não estava instalado. Foram verificados na prévia o total inicial de R$ 650 em 3 parcelas, recálculo de R$ 1.200 em 3 × R$ 400, confirmação transferindo R$ 200 para Realizados e reduzindo pendentes a R$ 450, navegação para dezembro (2 parcelas/R$ 350), fonte Geist e ausência de rolagem horizontal em larguras de 430 e 360 pixels. Prints inspecionados visualmente. A prévia não implementa persistência nem validação financeira definitiva; nenhuma mensagem, lançamento ou dado real foi alterado. Ainda faltam definir regras de datas, centavos, alterações/cancelamento, reembolso e limites do valor confirmado.

## Próximos passos

1. Retomar o contexto nesta fonte e inspecionar os componentes reais para manter aparência nativa.
2. Fechar apenas regras operacionais em aberto com impacto real, uma decisão por vez, e detalhar implementação por etapas.
3. Implementar e verificar localmente após as definições necessárias; não expor previsões aos relatórios de realizados. Testar cálculo e soma em centavos, datas, confirmação sem duplicidade, permissões e compatibilidade com lançamentos existentes.
4. Antes de modificar o banco de produção ou publicar mudanças de banco/segurança/pagamento, solicitar as autorizações exigidas no projeto. Não reutilizar autorizações da correção anterior do WhatsApp.

Qualquer alteração no banco de produção depende de autorização explícita e backup com restauração verificada, conforme `CLAUDE.md`. O pedido mais recente foi registrar a aprovação e preparar um prompt para retomar o trabalho em novo chat; não iniciar implementação nesta conversa.
