// Máscara de valor em reais (estilo transferência bancária) e conversão para número.

/** Digita só números e vira "1.234,56". */
export function formatCurrency(value: string): string {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '0,00';
    const cents = parseInt(digits, 10);
    const [intPart, decPart] = (cents / 100).toFixed(2).split('.');
    return `${intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decPart}`;
}

/** "1.500,50" → "1500.50" */
export function parseBRLtoNumber(value: string): string {
    return value.replace(/\./g, '').replace(',', '.');
}

/** "1500.50" (reais em texto) → "1.500,50" para preencher o campo com máscara. */
export function reaisParaMascara(reais: string): string {
    return formatCurrency(reais.replace(/\D/g, ''));
}

export function formatBRL(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}
