// Textos de erro das ações de compras no cartão, para exibir ao usuário.
export const COMPRA_ERROS: Record<string, string> = {
    NAO_AUTORIZADO: 'Sem permissão para esta operação.',
    CAMPOS_INVALIDOS: 'Verifique os campos e tente novamente.',
    CONFLITO_CONCORRENTE: 'Conflito detectado. Tente novamente em instantes.',
    USUARIO_INATIVO: 'Sua conta está inativa.',
    RATE_LIMIT: 'Muitas tentativas. Aguarde um momento.',
    PARCELA_JA_PAGA: 'Esta parcela já foi paga.',
    PARCELA_CANCELADA: 'Esta parcela foi cancelada.',
    COMPRA_CANCELADA: 'Esta compra já foi cancelada.',
    DATA_FUTURA: 'A data do pagamento não pode ser no futuro.',
    SEM_PENDENTES: 'Não há parcelas pendentes para cancelar.',
    ERRO_INTERNO: 'Erro interno. Tente novamente.',
};

export function mensagemCompraErro(r: { code: string; message?: string }): string {
    // Mensagens de validação em português (Zod) são mais úteis que o texto genérico
    if (r.code === 'CAMPOS_INVALIDOS' && r.message) return r.message;
    return COMPRA_ERROS[r.code] ?? COMPRA_ERROS.ERRO_INTERNO;
}

export function rotuloCartao(c: { titular: string; banco: string | null; bandeira: string | null }): string {
    return [c.titular, c.banco, c.bandeira].filter(Boolean).join(' · ');
}
