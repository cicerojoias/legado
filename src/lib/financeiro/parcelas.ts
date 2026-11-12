// Cálculo de parcelas de compras no cartão (docs/PLANO-COMPRAS-PARCELADAS.md).
// Funções puras: valores em centavos inteiros e datas como texto "AAAA-MM-DD",
// sem Date local, para não ter erro de centavo nem de fuso horário.

export const MAX_PARCELAS = 36;

export type ParcelaCalculada = {
    numero: number;
    valorCentavos: number;
    vencimento: string; // AAAA-MM-DD
};

/** "1.234,56" | "1234,56" | "1234.56" | 1234.56 → 123456. null se inválido ou <= 0. */
export function reaisParaCentavos(valor: string | number): number | null {
    let s = typeof valor === 'number' ? valor.toFixed(2) : valor.trim();
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
    const [inteiro, dec = ''] = s.split('.');
    const centavos = Number(inteiro) * 100 + Number(dec.padEnd(2, '0'));
    return Number.isSafeInteger(centavos) && centavos > 0 ? centavos : null;
}

export function centavosParaReais(centavos: number): string {
    return (centavos / 100).toFixed(2);
}

/** Divide em n parcelas inteiras; a sobra de centavos vai para a PRIMEIRA (100,00 em 3× = 33,34 + 33,33 + 33,33). */
export function dividirEmCentavos(totalCentavos: number, n: number): number[] {
    if (!Number.isInteger(totalCentavos) || totalCentavos <= 0) throw new RangeError('Total inválido');
    if (!Number.isInteger(n) || n < 1 || n > MAX_PARCELAS) throw new RangeError('Quantidade de parcelas inválida');
    const base = Math.floor(totalCentavos / n);
    const sobra = totalCentavos - base * n;
    return Array.from({ length: n }, (_, i) => (i === 0 ? base + sobra : base));
}

function ultimoDiaDoMes(ano: number, mes: number): number {
    return new Date(Date.UTC(ano, mes, 0)).getUTCDate(); // mes 1-12
}

export function dataValida(iso: string): boolean {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (!m) return false;
    const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return mes >= 1 && mes <= 12 && dia >= 1 && dia <= ultimoDiaDoMes(ano, mes);
}

/**
 * Vencimento da parcela `indice` (0 = primeira). Sempre a partir do dia ORIGINAL
 * (31/01 → 28/02 → 31/03 → 30/04), nunca encadeado na parcela anterior.
 * Mês sem o dia escolhido usa o último dia do mês.
 */
export function vencimentoDaParcela(primeiroVencimento: string, indice: number): string {
    if (!dataValida(primeiroVencimento)) throw new RangeError('Data inválida');
    const [ano0, mes0, dia0] = primeiroVencimento.split('-').map(Number);
    const mesesTotal = (mes0 - 1) + indice;
    const ano = ano0 + Math.floor(mesesTotal / 12);
    const mes = (mesesTotal % 12) + 1;
    const dia = Math.min(dia0, ultimoDiaDoMes(ano, mes));
    return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

export function gerarParcelas(totalCentavos: number, n: number, primeiroVencimento: string): ParcelaCalculada[] {
    return dividirEmCentavos(totalCentavos, n).map((valorCentavos, i) => ({
        numero: i + 1,
        valorCentavos,
        vencimento: vencimentoDaParcela(primeiroVencimento, i),
    }));
}

export function somaCentavos(parcelas: { valorCentavos: number }[]): number {
    return parcelas.reduce((acc, p) => acc + p.valorCentavos, 0);
}

/** Texto "AAAA-MM-DD" → Date UTC à meia-noite, para gravar em colunas @db.Date sem deslocar o dia. */
export function isoParaDataUTC(iso: string): Date {
    return new Date(`${iso}T00:00:00.000Z`);
}

/** Date de coluna @db.Date → "AAAA-MM-DD". */
export function dataUTCParaIso(d: Date): string {
    return d.toISOString().slice(0, 10);
}
