// Formatação de datas "AAAA-MM-DD" sem Intl nem fuso: mesmo resultado no servidor e no navegador
// (evita erro de hidratação — regra 2 do CLAUDE.md).

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function formatarDataBR(iso: string): string {
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
}

export function formatarDiaMes(iso: string): string {
    const [, m, d] = iso.split('-');
    return `${d}/${m}`;
}

/** "2026-11" → "Novembro 2026" */
export function nomeMes(mes: string): string {
    const [a, m] = mes.split('-');
    return `${MESES[Number(m) - 1]} ${a}`;
}

export function nomeMesSo(mes: string): string {
    return MESES[Number(mes.split('-')[1]) - 1];
}

export function mesValido(mes: string | undefined): mes is string {
    return !!mes && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

export function deslocarMes(mes: string, delta: number): string {
    const [a, m] = mes.split('-').map(Number);
    const total = a * 12 + (m - 1) + delta;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Data de hoje no Brasil (UTC-3, sem horário de verão) como "AAAA-MM-DD". */
export function hojeBrasilIso(agora: number = Date.now()): string {
    return new Date(agora - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
