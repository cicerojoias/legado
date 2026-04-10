export const METODOS_ENTRADA = ['PIX', 'C_DEBITO', 'C_CREDITO', 'ESPECIE'] as const;
export const METODOS_SAIDA = ['PIX', 'ESPECIE'] as const;

export const METODO_LABELS: Record<string, string> = {
    PIX: 'PIX',
    C_DEBITO: 'Débito',
    C_CREDITO: 'Crédito',
    ESPECIE: 'Dinheiro',
    TON: 'Débito',
    DINHEIRO: 'Dinheiro',
};

export function getMetodoPgtoLabel(metodo: string | null | undefined) {
    if (!metodo) return '—';
    return METODO_LABELS[metodo] ?? metodo;
}

export function normalizeMetodoPgto(metodo: string | null | undefined) {
    if (!metodo) return null;
    if (metodo === 'TON') return 'C_DEBITO';
    if (metodo === 'DINHEIRO') return 'ESPECIE';
    return metodo;
}
