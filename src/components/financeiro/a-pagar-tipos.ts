// Tipos serializáveis (servidor → cliente) da aba "A pagar". Valores em reais como texto ("33.34")
// e datas como "AAAA-MM-DD": nada de Decimal/Date cruzando a fronteira, e sem erro de hidratação.

export type CartaoInfo = {
    titular: string;
    banco: string | null;
    bandeira: string | null;
};

export type SituacaoParcela = 'PAGA' | 'PENDENTE' | 'CANCELADA';

export type ParcelaDetalhe = {
    id: string;
    numero: number;
    valor: string;
    vencimento: string;
    situacao: SituacaoParcela;
    pagaEm: string | null;
};

export type CompraInfo = {
    id: string;
    descricao: string;
    categoria: string | null;
    valorTotal: string;
    qtd: number;
    loja: 'JOAO_PESSOA' | 'SANTA_RITA';
    cartao: CartaoInfo;
    observacao: string | null;
    cancelada: boolean;
    parcelas: ParcelaDetalhe[];
};

export type StatusVencimento = 'ATRASADA' | 'HOJE' | 'AGENDADA';

export type ParcelaPendente = {
    id: string;
    numero: number;
    valor: string;
    vencimento: string;
    status: StatusVencimento;
    compraId: string;
};

export type ResumoCartao = CartaoInfo & { totalCentavos: number; qtd: number };
