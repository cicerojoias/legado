import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { PerfilContent, type ChangelogEntry } from './perfil-content';

// ─── Changelog resumido (SUPER_ADMIN) — definido no Server Component ────────
// para evitar peso no bundle JS do cliente.

const CHANGELOG_RESUMIDO: ChangelogEntry[] = [
    { versao: '0.18.67', data: '02/06/2026', resumo: 'WAB: resolução de conflito de rotas dinâmicas do Next.js unificando [conversationId] e [id] sob o mesmo slug [id] no endpoint de busca de mensagens' },
    { versao: '0.18.66', data: '01/06/2026', resumo: 'WAB: correção crítica na validação do token do Webhook (WHATSAPP_VERIFY_TOKEN) tolerando fallback para WHATSAPP_WEBHOOK_VERIFY_TOKEN, restabelecendo a recepção de novas mensagens após deploy' },
    { versao: '0.18.65', data: '26/05/2026', resumo: 'WAB: localizador de mensagens por palavras-chave dentro do chat específico com rolagem automática inteligente, destaque dourado e AbortController para evitar requisições concorrentes obsoletas' },
    { versao: '0.18.64', data: '26/05/2026', resumo: 'WAB: fix scroll infinito — correção do cursor de paginação ignorando conversas vazias sem data de última mensagem (last_message_at: null), permitindo o fluxo infinito com nulos no fim da lista' },
    { versao: '0.18.63', data: '26/05/2026', resumo: 'WAB: fix timezone em tempo real — correção na interpretação do timestamp de mensagens recebidas/enviadas via Supabase Realtime, garantindo que o fuso horário (America/Recife) seja aplicado corretamente e evitando deslocamentos de data/hora' },
    { versao: '0.18.62', data: '26/05/2026', resumo: 'WAB: fix scroll infinito — correção no atrelamento do virtualizador de rolagem ao elemento do DOM pós-montagem, garantindo o carregamento automático de conversas antigas (como as de março/abril)' },
    { versao: '0.18.61', data: '21/05/2026', resumo: 'WAB: correção crítica do loading infinito ao clicar em conversas no desktop — removido router.refresh() imediato no mount da sidebar e adicionado debounce de 800ms nos event handlers do realtime para evitar interferência com navegações ativas do Next.js' },
    { versao: '0.18.60', data: '21/05/2026', resumo: 'WAB: refatoração completa do Realtime em arquitetura centralizada síncrona de evento único via layout, reduzindo conexões Websocket e garantindo sincronização instantânea de mensagens e badges (não lidas) em tempo real sem F5' },
    { versao: '0.18.59', data: '21/05/2026', resumo: 'WAB: correção da condição de corrida na inicialização do realtime e implementação de cliente singleton do Supabase, garantindo conexões autenticadas corretas' },
    { versao: '0.18.58', data: '21/05/2026', resumo: 'WAB: liberação de políticas de RLS para operadores e gerentes no Supabase, corrigindo bug de mensagens e lista de conversas não atualizarem automaticamente em tempo real para não-admins' },
    { versao: '0.18.57', data: '20/05/2026', resumo: 'WAB: invalidação forçada do Next.js Router Cache ao retornar para o Inbox, garantindo atualização instantânea dos badges de não lidas no mobile' },
    { versao: '0.18.56', data: '20/05/2026', resumo: 'WAB: correção e sincronização instantânea dos badges (notificações) de mensagens não lidas no painel e na barra lateral ao abrir e ler chats' },
    { versao: '0.18.55', data: '20/05/2026', resumo: 'WAB: integração com Cloudflare R2 para armazenamento permanente e seguro de mídias recebidas (inbound) e remoção de arquivos mortos' },
    { versao: '0.18.54', data: '20/05/2026', resumo: 'WAB: suporte a rolagem infinita (scroll infinito) com paginação dinâmica baseada em cursor no histórico de conversas da barra lateral' },
    { versao: '0.18.53', data: '20/05/2026', resumo: 'WAB: polimento e refinamento do indicador flutuante de data com fade-out por inatividade, sem sobreposições e visibilidade inteligente apenas sob rolagem' },
    { versao: '0.18.52', data: '20/05/2026', resumo: 'WAB: divisores de data e cabeçalho flutuante (sticky) nas conversas do chat para melhor legibilidade e organização temporal' },
    { versao: '0.18.51', data: '20/05/2026', resumo: 'WAB/PWA: navegação global ao clicar nas notificações push, fuso horário UTC-3 e filtro de deletados no resumo financeiro, correção de timezone de recebimento de mensagens e exibição precisa de ontem/dias da semana no chat/sidebar' },
    { versao: '0.18.50', data: '19/05/2026', resumo: 'Relatórios: módulo de relatório anual premium com visualização de desempenho mensal, gráfico de barras com rolagem horizontal otimizada para mobile e painel com lista de resumo numérico' },
    { versao: '0.18.49', data: '19/05/2026', resumo: 'WAB: remoção da bolinha de status "online" enganosa e implementação de gerador robusto de iniciais de avatares para nomes únicos, emojis e pontuações com fallback inteligente para DDD' },
    { versao: '0.18.48', data: '15/05/2026', resumo: 'WAB: placeholders para todos os tipos de mensagem Meta — figurinha (lightbox), localização (link Maps), contato, pedido, botão/interativo, sistema e não-suportado' },
    { versao: '0.18.47', data: '15/05/2026', resumo: 'WAB: pinch-to-zoom no lightbox — pinça (mobile), scroll de mouse (desktop), arrastar para pan, duplo toque para zoom 2.5x e reset; ESC/backdrop redefine zoom antes de fechar' },
    { versao: '0.18.46', data: '15/05/2026', resumo: 'WAB: fullscreen de imagem — clicar em qualquer foto no chat abre lightbox animado (Framer Motion) com backdrop escuro, botão X e fechamento por ESC ou clique fora' },
    { versao: '0.18.45', data: '14/05/2026', resumo: 'fix: ícone de notificação push no Samsung One UI — badge agora usa badge-96.png monocromático com fundo transparente em vez de icon-192.png (que rendia círculo branco na barra de status)' },
    { versao: '0.18.44', data: '14/05/2026', resumo: 'fix: notificações push WAB — dispatchPushForConversation não exige mais notif_push=true; alertas de mensagens chegam a qualquer usuário com subscription ativa' },
    { versao: '0.18.43', data: '01/05/2026', resumo: 'WAB: simplificação de templates — apenas Retomar Atendimento disponível; removidos Boas-vindas, Peça Pronta e Orçamento do seletor pós-24h' },
    { versao: '0.18.42', data: '01/05/2026', resumo: 'WAB: fix envio de templates WhatsApp — removido componente header para alinhar com configuração do Meta (header opcional); corrige erro de validação da API' },
    { versao: '0.18.41', data: '01/05/2026', resumo: 'WAB: templates pós-24h — validação em tempo real, indicadores visuais (✅/❌/🔄), endpoint validate-template e guia de configuração no Meta Business Manager' },
    { versao: '0.18.40', data: '28/04/2026', resumo: 'GitHub Actions: cron job gratuito configurado para resumo diário — substitui Vercel Cron (Plano Pro); workflow executa diariamente às 18:00 UTC (15:00 BRT) via schedule + workflow_dispatch' },
    { versao: '0.18.39', data: '28/04/2026', resumo: 'WAB: long press no desktop — apertar e segurar mouse sobre mensagem/imagem ativa modo de seleção (igual ao mobile); imagens não disparam mais drag nativo' },
    { versao: '0.18.38', data: '27/04/2026', resumo: 'Perfil: changelog migrado para Server Component — reduz bundle JS do cliente; type guard isAuthError substitui (as any) nos erros do Supabase Auth' },
    { versao: '0.18.37', data: '27/04/2026', resumo: 'WAB: fix resposta automática do menu — quando cliente respondia "1" ou "2" após o welcome, lookup pegava a inbound mais antiga (orçamento, etc.) em vez da mensagem digitada; reverse() indevido removido em tryHandleWelcomeMenu' },
    { versao: '0.18.36', data: '22/04/2026', resumo: 'Lançamentos: categorias separadas por tipo — Entrada (Conserto, Banho de Ouro, Aliança, etc.) e Saída (Despesa Fixa, Fornecedor, Manutenção, Transporte/Frete, Marketing); padrão muda automaticamente ao trocar o tipo' },
    { versao: '0.18.34', data: '15/04/2026', resumo: 'WAB: quando cliente cita uma mensagem no WhatsApp dele, a bolha de resposta exibe o trecho citado — webhook passa a processar o campo context da Meta' },
    { versao: '0.18.33', data: '15/04/2026', resumo: 'WAB: confirmação de leitura — ticks ficam azuis (✓✓ azul) quando o cliente lê a mensagem; tooltip "Lida pelo cliente" ao passar o mouse' },
    { versao: '0.18.32', data: '15/04/2026', resumo: 'RBAC: role GERENTE criada — acessa hoje, lançamentos, WAB e perfil; sem acesso a relatórios, custos fixos, usuários e logs' },
    { versao: '0.18.31', data: '15/04/2026', resumo: 'Usuários: modal "Novo Usuário" com dois modos — criar do zero (Auth + banco) ou vincular conta já existente no Auth pelo e-mail' },
    { versao: '0.18.29', data: '15/04/2026', resumo: 'Assistente IA: migrado de Gemini para GPT-4o, endpoint protegido com autenticação, módulo /assistente removido — IA do atendente consolidada no WAB' },
    { versao: '0.18.28', data: '14/04/2026', resumo: 'Usuários: edição de role (ADMIN/OPERADOR) — Super Admin pode alterar nível de acesso dos usuários no modal de edição' },
    { versao: '0.18.27', data: '12/04/2026', resumo: 'Assistente IA integrado ao chat — botão ✨ no MessageInput gera mensagens contextuais com opções aceitar/editar/rejeitar, injetando direto no campo de texto' },
    { versao: '0.18.26', data: '11/04/2026', resumo: 'WAB: correção do status de leitura — marca mensagens como lidas na API da Meta ao abrir conversa (dois traços dourados)' },
    { versao: '0.18.25', data: '11/04/2026', resumo: 'WAB: orçamento de aliança — seleção múltipla de materiais (Prata 990, Ouro 16k, Ouro 18k), cálculo 6x sem juros, largura customizável' },
    { versao: '0.18.24', data: '11/04/2026', resumo: 'Segurança: rate limiter migrado de memória volátil para Upstash Redis — bloqueio de PIN e login agora persiste entre instâncias serverless e cold starts' },
    { versao: '0.18.23', data: '10/04/2026', resumo: 'Hoje: input valor foca e seleciona automaticamente após lançamento — sem precisar clicar' },
    { versao: '0.18.22', data: '10/04/2026', resumo: 'WAB: 4 ícones de ação na conversa condensados em menu de 3 pontinhos (IA, orçamento, limpar, excluir)' },
    { versao: '0.18.21', data: '10/04/2026', resumo: 'WAB: modal de configurações — corrige import AnimatePresence e layout colapsado (flex-1 sem altura explícita)' },
    { versao: '0.18.16', data: '10/04/2026', resumo: 'Hoje: peso do valor do saldo reduzido de black para semibold' },
    { versao: '0.18.15', data: '10/04/2026', resumo: 'Hoje: fechamento do dia começa fechado por padrão; seta corrigida' },
    { versao: '0.18.14', data: '10/04/2026', resumo: 'Hoje: fechamento do dia recolhível — tap para expandir/recolher detalhes; preferência salva no dispositivo' },
    { versao: '0.18.13', data: '10/04/2026', resumo: 'WAB: Enter envia mensagem em qualquer dispositivo; Shift+Enter pula linha' },
    { versao: '0.18.12', data: '10/04/2026', resumo: 'Hoje: fechamento do dia no mobile compactado — menos espaço vertical, formas de pagamento em linha única' },
    { versao: '0.18.11', data: '09/04/2026', resumo: 'WAB: prompt da IA passou a usar bloco JSON oficial de servicos compartilhado entre o atendimento e o gerador de respostas' },
    { versao: '0.18.10', data: '09/04/2026', resumo: 'WAB: prompt da IA formalizado com mapa oficial de servicos em Fazemos, Nao fazemos e Depende para evitar negativas por suposicao' },
    { versao: '0.18.9', data: '09/04/2026', resumo: 'WAB: system prompt da IA refinado com contexto operacional mais completo, regras mais fortes de escalonamento e respostas mais consistentes' },
    { versao: '0.18.8', data: '09/04/2026', resumo: 'WAB: IA agora espaça mensagens segmentadas com intervalo humano entre respostas' },
    { versao: '0.18.7', data: '09/04/2026', resumo: 'WAB: janela de elegibilidade da IA ampliada para 36h, mantendo preview e resposta segura do backlog' },
    { versao: '0.18.6', data: '09/04/2026', resumo: 'WAB: módulo de notas compactado — painel recolhível e mais enxuto para ocupar menos espaço no chat' },
    { versao: '0.18.5', data: '09/04/2026', resumo: 'WAB: correção do preview de ativação da IA — backlog agora considera a última mensagem humana, não qualquer outbound' },
    { versao: '0.18.4', data: '09/04/2026', resumo: 'WAB: IA com confirmação visual e modo pendências — responde backlog das últimas 24h com contexto das últimas 20 msgs, múltiplas mensagens curtas e emojis moderados' },
    { versao: '0.18.3', data: '09/04/2026', resumo: 'WAB: notas internas por conversa — painel recolhível no mobile, visível para todos os atendentes, com criação, edição e exclusão dentro do chat' },
    { versao: '0.18.2', data: '06/04/2026', resumo: 'WAB: system prompt da IA enriquecido com contexto completo da Cícero Joias — serviços, diferenciais, garantias, tom caloroso e regras de escalonamento para humano' },
    { versao: '0.18.1', data: '06/04/2026', resumo: 'WAB: modais (configurações, tags, templates) migrados para React Portal — corrige bottom sheet não aparecendo no Chrome Android' },
    { versao: '0.18.0', data: '05/04/2026', resumo: 'WAB: resposta automática com IA (GPT-4o Mini) — toggle por conversa no header; histórico das últimas 20 msgs como contexto; roda em background após ack ao Meta' },
    { versao: '0.17.0', data: '04/04/2026', resumo: 'WAB: modal de configurações (⋮) — boas-vindas automática após 7 dias de silêncio (toggle + mensagem configurável); mensagens rápidas e tags migram para dentro do settings; ⚡ e 🏷️ removidos do header' },
    { versao: '0.16.1', data: '04/04/2026', resumo: 'WAB: fix over-scroll no chat (espaço fantasma após teclado); seleção de cor da tag com checkmark branco em vez de ring grosso; nome da tag preserva capitalização' },
    { versao: '0.16.0', data: '04/04/2026', resumo: 'WAB: módulo de tags — categorize conversas com labels coloridas; filtro por tag na lista; badges no item; painel de tags no header da conversa; gerenciador CRUD via ícone Tag (ADMIN+)' },
    { versao: '0.15.5', data: '04/04/2026', resumo: 'WAB: menu de templates scrollável — max-height dinâmico (40dvh) com teclado aberto; touch-scroll desbloqueado no menu' },
    { versao: '0.15.4', data: '04/04/2026', resumo: 'WAB: filtro "Não lidas" — tabs Todas/Não lidas abaixo da busca com badge de contagem; ocultas durante pesquisa' },
    { versao: '0.15.3', data: '04/04/2026', resumo: 'WAB: gerenciador de mensagens rápidas — ícone ⚡ no header abre modal CRUD; templates persistidos por dispositivo' },
    { versao: '0.15.2', data: '04/04/2026', resumo: 'WAB: templates de mensagem — digita / no chat para inserir respostas rápidas; Formatura habilitada no modal de orçamento' },
    { versao: '0.15.1', data: '03/04/2026', resumo: 'PIN: teclado some durante verificação e exibe círculo de loading centralizado' },
    { versao: '0.15.0', data: '31/03/2026', resumo: 'WAB: módulo de orçamentos — botão 📋 no chat abre preset de Banho de Ouro; parcelas auto-calculadas; insere direto no textarea' },
    { versao: '0.14.6', data: '31/03/2026', resumo: 'WAB: fix AudioPlayer — duration 0:00 em proxy streams; load() explícito no mount + onDurationChange/onCanPlay' },
    { versao: '0.14.5', data: '31/03/2026', resumo: 'WAB: fix alinhamento bolhas (max-w no flex item, não no filho); player de áudio customizado (play/pause/barra); deleted message corrigido' },
    { versao: '0.14.4', data: '31/03/2026', resumo: 'WAB: fix alinhamento das bolhas — substituído flex-row-reverse por flex-row + ml-auto; margem esquerda/direita agora sempre consistente' },
    { versao: '0.14.3', data: '31/03/2026', resumo: 'WAB: fix encaminhar mídia — salva mediaUrl na mensagem encaminhada; imagens/vídeos não aparecem mais como [Imagem indisponível]' },
    { versao: '0.14.2', data: '31/03/2026', resumo: 'WAB: reagir em modo seleção — barra flutuante de emojis estilo WhatsApp (aparece com 1 msg selecionada); botão Smile oculto no mobile' },
    { versao: '0.14.1', data: '31/03/2026', resumo: 'WAB: fix encaminhar — botão visível (z-index acima do BottomNav); fix reações — Smile visível no mobile e fecha ao entrar no modo seleção' },
    { versao: '0.14.0', data: '31/03/2026', resumo: 'WAB: encaminhar mensagens — selecionar → ↗ → bottom sheet estilo WhatsApp com busca, multi-conversa e indicador "Encaminhada" na bolha' },
    { versao: '0.13.2', data: '31/03/2026', resumo: 'WAB: fix overscroll — listener nativo non-passive no container do input impede drag na área de padding scrollar a página' },
    { versao: '0.13.1', data: '31/03/2026', resumo: 'WAB: fix seleção — sem borda cinza em msgs recebidas, "Cícero Joias" no copy, imagem+legenda copiados; Perfil: changelog limitado a 3 entradas' },
    { versao: '0.13.0', data: '31/03/2026', resumo: 'WAB: selecionar mensagens — long press seleciona, copiar e deletar (janela 60h) com feedback granular' },
    { versao: '0.12.9', data: '31/03/2026', resumo: 'WAB: fix ícone de reply duplicado no mobile — swipe centralizado' },
    { versao: '0.12.7', data: '31/03/2026', resumo: 'WAB: reações às mensagens — segurar para reagir com ✅💚🤝🙏' },
    { versao: '0.12.6', data: '31/03/2026', resumo: 'WAB: fix horário das mensagens — fuso America/Recife em lista e chat' },
    { versao: '0.12.5', data: '31/03/2026', resumo: 'WAB: fix espaço abaixo do input e header sumindo ao scrollar' },
    { versao: '0.12.4', data: '31/03/2026', resumo: 'WAB: fix layout mobile — header e input sempre fixos, scroll só nas mensagens' },
    { versao: '0.12.3', data: '31/03/2026', resumo: 'WAB: fix scroll horizontal durante swipe-to-reply' },
    { versao: '0.12.2', data: '31/03/2026', resumo: 'WAB: swipe para direita ativa reply (igual WhatsApp)' },
    { versao: '0.12.1', data: '31/03/2026', resumo: 'WAB: fix reply — citação aparece corretamente no WhatsApp do cliente' },
    { versao: '0.12.0', data: '31/03/2026', resumo: 'WAB: scroll inteligente com botão flutuante de novas mensagens' },
    { versao: '0.11.0', data: '31/03/2026', resumo: 'WAB: Realtime, não lidas, infinite scroll, reply e busca' },
    { versao: '0.10.0', data: '31/03/2026', resumo: 'WAB: push notifications nativas via Web Push / VAPID' },
];

export default async function PerfilPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect('/login');

    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
            id: true,
            nome: true,
            email: true,
            role: true,
            lojaAutorizada: true,
            lojaPadrao: true,
            notif_push: true,
            notif_horario: true,
        },
    });

    if (!dbUser) redirect('/login');

    return (
        <div className="min-h-full">
            <Suspense fallback={null}>
                <div className="mx-auto max-w-2xl px-4 md:px-0">
                    <PerfilContent
                        nome={dbUser.nome}
                        email={dbUser.email}
                        role={dbUser.role}
                        lojaAutorizada={dbUser.lojaAutorizada}
                        lojaPadrao={dbUser.lojaPadrao}
                        notifPush={dbUser.notif_push}
                        notifHorario={dbUser.notif_horario}
                        changelog={CHANGELOG_RESUMIDO}
                    />
                </div>
            </Suspense>
        </div>
    );
}
