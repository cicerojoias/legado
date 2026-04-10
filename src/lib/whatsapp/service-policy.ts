export type ServicePolicyStatus = 'fazemos' | 'nao_fazemos' | 'depende'

export type ServicePolicyEntry = {
  servico: string
  notas?: string[]
}

export type ServicePolicy = {
  unknown_service_rule: string
  fazemos: ServicePolicyEntry[]
  nao_fazemos: ServicePolicyEntry[]
  depende: ServicePolicyEntry[]
}

export const SERVICE_POLICY: ServicePolicy = {
  unknown_service_rule:
    'Se o servico nao estiver listado explicitamente em fazemos, nao fazemos ou depende, nunca responda "nao fazemos" por suposicao. Confirme com um especialista ou peça foto/orcamento/avaliacao.',
  fazemos: [
    {
      servico: 'Aliancas personalizadas',
      notas: [
        'Materiais: prata 990, ouro 16k e ouro 18k',
        'Tecnica exclusiva sem emendas',
        'Gravacao inclusa',
        'Prazo medio: 7 dias uteis',
        'Manutencao gratuita por 12 meses',
      ],
    },
    {
      servico: 'Banho de ouro profissional',
      notas: [
        'Ouro 18k com opcoes basico, intermediario e avancado',
        'Prazo medio: 14 dias uteis',
        'Aceita joias, semijoias, bijuterias, prata e objetos metalicos',
        'Nao realiza banho em relogios',
      ],
    },
    {
      servico: 'Consertos especializados de joias',
      notas: ['Solda', 'ajuste de aro', 'reposicao de pedras', 'troca de fechos'],
    },
    { servico: 'Conserto de corrente e colar de joia' },
    { servico: 'Solda de corrente fina' },
    { servico: 'Conserto de joias com pedra solta ou quebrada' },
    { servico: 'Conserto de pecas de prata' },
    { servico: 'Conserto de pecas de ouro' },
    { servico: 'Conserto de pecas folheadas' },
    { servico: 'Conserto de bijuteria' },
    { servico: 'Banho de ouro em pecas de aco' },
    { servico: 'Troca de bateria de relogio comum' },
    { servico: 'Troca de bateria de relogio digital' },
    { servico: 'Troca de maquina de relogio' },
    { servico: 'Troca de vidro de relogio' },
    { servico: 'Revisao e limpeza interna de relogios' },
    { servico: 'Conserto de fecho de relogio' },
    { servico: 'Ajuste de elos de pulseira metalica' },
    { servico: 'Troca de pulseira de relogio de couro' },
    { servico: 'Troca de pulseira de relogio de silicone ou borracha' },
    { servico: 'Lentes de oculos' },
    { servico: 'Troca de plaqueta, mola e parafusos' },
    { servico: 'Ajuste e alinhamento de armação' },
    { servico: 'Limpeza de joias' },
    {
      servico: 'Polimento de joias',
      notas: ['Prata, ouro e aco', 'Especialmente aliancas e aneis'],
    },
    {
      servico: 'Gravacao personalizada em joias',
      notas: ['Servico terceirizado', 'Exige orcamento', 'Peca fica na loja', 'Prazo de 3 dias uteis'],
    },
  ],
  nao_fazemos: [
    { servico: 'Banho de ouro em relogios' },
    { servico: 'Conserto de smartwatch' },
    { servico: 'Polimento de relogios' },
    { servico: 'Relogios de corda ou automaticos' },
    { servico: 'Visor ou display de relogio digital' },
  ],
  depende: [
    {
      servico: 'Joias sob medida',
      notas: ['Apenas alguns modelos', 'Anes de formatura, aliancas e alguns pingentes basicos'],
    },
    { servico: 'Peças em aco', notas: ['Depende de foto'] },
    { servico: 'Conserto de relogio digital', notas: ['Alguns modelos', 'principalmente baterias', 'confirmar por foto/orcamento'] },
    { servico: 'Troca de corrente de relogio por outra equivalente', notas: ['Depende de orcamento e disponibilidade da peça'] },
    { servico: 'Conserto de pulseira ou bracelete de relogio', notas: ['Depende da peça', 'recomendar foto'] },
    { servico: 'Troca de fecho de relogio', notas: ['Mediante disponibilidade da peça'] },
    { servico: 'Troca de vidro de relogio digital', notas: ['Mediante orcamento', 'smartwatch/display nao'] },
    { servico: 'Restauracao de joia antiga', notas: ['Depende de avaliacao'] },
  ],
}

export const SERVICE_POLICY_JSON_BLOCK = `\`\`\`json
${JSON.stringify(SERVICE_POLICY, null, 2)}
\`\`\``
