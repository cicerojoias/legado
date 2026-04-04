export interface Template {
  slug: string      // usado como /slug
  label: string     // nome exibido no menu
  content: string   // texto inserido no textarea
}

export const TEMPLATES: Template[] = [
  {
    slug: 'boasvindas',
    label: 'Boas-vindas',
    content:
      'Olá, seja bem-vindo(a) à Cícero Joias! ✨\n\n' +
      'Temos 40 anos de tradição em:\n\n' +
      '1️⃣ Alianças, anéis de formatura e joias sob medida 💍\n' +
      '2️⃣ Banho de ouro premium 🔸\n' +
      '3️⃣ Joias em geral, relógios e armações de óculos 💎\n' +
      '4️⃣ Consertos profissionais de joias, relógios e óculos 🔧\n\n' +
      '0️⃣ Falar com um atendente 👥\n\n' +
      'Digite o número da opção desejada e aguarde.\n\n' +
      'Em breve entraremos em contato! ☺️',
  },
  {
    slug: '0',
    label: 'Opção 0 — Atendente',
    content:
      'Você optou por *Falar com um atendente*! 👥\n\n' +
      'Por favor, aguarde um momento. Em breve, estaremos à sua disposição. 😊\n\n' +
      'Para otimizar seu atendimento, sinta-se à vontade para deixar sua mensagem agora. ✨',
  },
  {
    slug: '1',
    label: 'Opção 1 — Alianças e joias sob medida',
    content:
      'Você escolheu *Alianças, anéis de formatura e joias sob medida*! 💍\n\n' +
      '• *Prazo de fabricação:* até 7 dias (pode variar). ⏳\n' +
      '• *Gravação interna gratuita.* ✍️\n' +
      '• *Acompanha caixinha de veludo.* 🎁\n' +
      '• *Qualidade e preço de fábrica.* 🏭\n' +
      '• *Não quebra, feitas sem emenda.* 🔗\n\n' +
      'Envie fotos ou um modelo de referência para orçamento, ou solicite o catálogo. ✨',
  },
  {
    slug: '2',
    label: 'Opção 2 — Banho de Ouro',
    content:
      'Você escolheu *Banho de Ouro Premium*! 🔸\n\n' +
      '• *Básico* 🥉 – sem garantia\n' +
      '• *Intermediário* 🥈 – garantia de 6 meses\n' +
      '• *Avançado* 🥇 – garantia de 1 ano\n\n' +
      '• *Prazo de serviço:* sob consulta (depende da demanda) ⏳\n' +
      '• *Preço:* sob consulta (varia conforme a peça)\n\n' +
      'Envie foto da peça para podermos lhe enviar o orçamento. 📸',
  },
  {
    slug: '3',
    label: 'Opção 3 — Joias, Relógios e Óculos',
    content:
      'Você escolheu *Joias, Relógios e Óculos*! 💎\n\n' +
      '• *Joias:* brincos, cordões, pulseiras, tornozeleiras, pingentes e anéis (masculinos & femininos) 🔸\n' +
      '• *Relógios:* diversos modelos com garantia de 1 ano – consulte disponibilidade ⌚\n' +
      '• *Óculos:* armações modernas e lentes sob medida 👓\n\n' +
      'Envie o nome do produto ou solicite nosso catálogo para receber mais detalhes. ✨',
  },
  {
    slug: '4',
    label: 'Opção 4 — Consertos',
    content:
      'Você escolheu *Consertos Profissionais*! ✨\n\n' +
      '• *Relógios:* Troca de pilha, troca de peças, ajuste de pulseiras e mais. ⌚\n\n' +
      '• *Óculos:* Conserto de armações, troca de peças, soldas e mais. 👓\n\n' +
      '• *Joias:* Soldas, ajustes, restaurações, troca de abotoaduras e mais. 💍\n\n' +
      'Envie uma foto da peça para que possamos informar o orçamento. 📸',
  },
  {
    slug: 'envio',
    label: 'Envio pelos Correios',
    content:
      'Você pode enviar a peça pelos Correios ou pelo serviço de sua preferência. Todo o processo — desde o recebimento, andamento do serviço até a finalização — vamos te atualizando sempre! ✅✨\n' +
      'Quando a peça estiver pronta, solicitamos o valor do frete pra fazer a devolução até você 📦💚.',
  },
  {
    slug: 'pix',
    label: 'Dados do Pix',
    content:
      'Perfeito! Aqui estão os dados para o Pix:\n\n' +
      '🔑 Chave Pix: 83991180251\n' +
      '👤 Nome: Cícero Gomes\n' +
      '🏦 Banco: Mercado Pago\n\n' +
      'Assim que realizar o pagamento, por favor, nos envie o comprovante para agilizar o atendimento!\n\n' +
      '✅ Qualquer dúvida, estamos à disposição!',
  },
  {
    slug: 'endereco',
    label: 'Endereços das lojas',
    content:
      '*Nossos endereços*: 📍\n\n' +
      '*João Pessoa*\n' +
      '• Galeria Jardim - R. Duque de Caxias, 516 - Loja 06 - Centro, João Pessoa - PB, 58010-821\n\n' +
      '*Santa Rita*\n' +
      '• R. Praça Antenor Navarro, 37 - Centro, Santa Rita - PB, 58300-010',
  },
  {
    slug: 'obrigado',
    label: 'Agradecimento / encerramento',
    content:
      'Agradecemos por confiar na *Cícero Joias*! 💎\n\n' +
      'Foi um prazer atendê-lo(a).\n' +
      'Se precisar de algo mais, estamos sempre à disposição.\n\n' +
      'Siga-nos nas redes sociais para novidades e promoções exclusivas! ✨',
  },
]

export function matchTemplates(query: string): Template[] {
  const q = query.toLowerCase()
  return TEMPLATES.filter(
    (t) => t.slug.startsWith(q) || t.label.toLowerCase().includes(q)
  )
}
