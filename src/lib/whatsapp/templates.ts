/**
 * Templates de mensagem pré-aprovados pela Meta.
 *
 * IMPORTANTE: O campo `name` deve ser EXATAMENTE igual ao nome do template
 * criado e aprovado no Meta Business Manager (em letras minúsculas, sem espaços).
 *
 * Para criar/aprovar templates: Meta Business Manager → WhatsApp → Modelos de Mensagem
 */

export interface WaTemplateParam {
  label: string
  placeholder: string
}

export interface WaTemplateConfig {
  name: string          // Nome exato no Meta (ex: "retomar_atendimento")
  displayName: string   // Rótulo exibido na UI
  language: string      // Código de idioma (ex: "pt_BR")
  preview: string       // Texto do template com {{N}} para variáveis
  params: WaTemplateParam[]
}

export const WA_TEMPLATES: WaTemplateConfig[] = [
  {
    name: 'boas_vindas_cicero',
    displayName: 'Boas-vindas / Menu de Serviços',
    language: 'pt_BR',
    preview:
      'Olá, seja bem-vindo(a) à Cícero Joias! ✨\n\nTemos 40 anos de tradição em:\n\n1️⃣ Alianças, anéis de formatura e joias sob medida 💍\n2️⃣ Banho de ouro premium 🔸\n3️⃣ Joias em geral, relógios e armações de óculos 💎\n4️⃣ Consertos profissionais de joias, relógios e óculos 🔧\n\n0️⃣ Falar com um atendente 👥\n\nDigite o número da opção desejada e aguarde.\n\nEm breve entraremos em contato! ☺️',
    params: [],
  },
  {
    name: 'retomar_atendimento',
    displayName: 'Retomar Atendimento',
    language: 'pt_BR',
    preview: 'Olá {{1}}, tudo bem? Gostaríamos de dar continuidade ao seu atendimento na Cícero Joias. Podemos ajudá-lo(a)?',
    params: [
      { label: 'Nome do cliente', placeholder: 'Ex: João' },
    ],
  },
  {
    name: 'peca_pronta',
    displayName: 'Peça Pronta para Retirada',
    language: 'pt_BR',
    preview: 'Olá {{1}}, sua peça já está pronta! Pode passar em nossa loja para retirar. 😊',
    params: [
      { label: 'Nome do cliente', placeholder: 'Ex: Maria' },
    ],
  },
  {
    name: 'orcamento_joias',
    displayName: 'Envio de Orçamento',
    language: 'pt_BR',
    preview: 'Olá {{1}}, segue o orçamento solicitado: {{2}}. Qualquer dúvida, estamos à disposição!',
    params: [
      { label: 'Nome do cliente', placeholder: 'Ex: Carlos' },
      { label: 'Valor / descrição', placeholder: 'Ex: R$ 150,00 para conserto do anel' },
    ],
  },
]
