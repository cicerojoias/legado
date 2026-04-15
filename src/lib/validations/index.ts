import { z } from "zod";

// Dicionários Reutilizáveis
export const LojasEnum = z.enum(["JOAO_PESSOA", "SANTA_RITA", "AMBAS"]);
export const RolesEnum = z.enum(["SUPER_ADMIN", "ADMIN", "OPERADOR"]);
export const TipoLancamentoEnum = z.enum(["ENTRADA", "SAIDA"]);
export const MetodosPgtoEnum = z.enum(["PIX", "C_DEBITO", "C_CREDITO", "ESPECIE", "TON", "DINHEIRO"]);
export const MetodosPgtoCriacaoEnum = z.enum(["PIX", "C_DEBITO", "C_CREDITO", "ESPECIE"]);

// Validação Anti-Brute-Force & Sanitização Padrão
export const LoginSchema = z.object({
    email: z.string().email({ message: "Formato de e-mail inválido." }),
    password: z.string().min(6, { message: "Senha precisa ter no mínimo 6 caracteres." }),
});

export const FastAuthPinSchema = z.object({
    pin: z.string().length(4, { message: "O PIN deve consistir exatamente de 4 dígitos numéricos." }).regex(/^\d+$/, "Apenas números"),
});

export const SetupPinSchema = z.object({
    pin: z.string().length(4, "O PIN deve ter 4 dígitos numéricos.").regex(/^\d+$/, "Apenas números"),
    confirmPin: z.string().length(4, "A confirmação deve ter 4 dígitos.").regex(/^\d+$/, "Apenas números"),
}).refine((data) => data.pin === data.confirmPin, {
    message: 'Os PINs não conferem.',
    path: ['confirmPin'],
});

// Validação Robusta para Server Actions Financeiras
export const CriarLancamentoSchema = z.object({
    tipo: TipoLancamentoEnum,
    valor: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (ex: 150.50)").refine((val) => parseFloat(val) > 0, "O valor deve ser maior que zero"),
    descricao: z.string().max(100, "A descrição não pode ter mais de 100 caracteres").optional().transform((val) => val === "" ? undefined : val),
    metodo_pgto: MetodosPgtoCriacaoEnum.optional(),
    loja: LojasEnum,
    // Para evitar bugs de timezone no Client transformamos data para ISO direto no Servidor
});

// Edição de Lançamento: campos mutáveis + id obrigatório
// metodo_pgto usa z.string() livre (não MetodosPgtoEnum) pois valores legados
// como "TON" e "DINHEIRO" existem no banco e devem sobreviver ao ciclo de edição.
export const EditarLancamentoSchema = z.object({
    id: z.string().uuid("Formato de ID inválido"),
    tipo: TipoLancamentoEnum,
    valor: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (ex: 150.50)").refine((val) => parseFloat(val) > 0, "O valor deve ser maior que zero"),
    descricao: z.string().max(200, "Máximo 200 caracteres").optional(),
    metodo_pgto: z.string().max(50).nullable().optional(),
});

// A Exclusão exige validação estrita do ID
export const DeleteQuerySchema = z.object({
    id: z.string().uuid("Formato de ID inválido"),
});

// Custos Fixos
export const CriarCustoFixoSchema = z.object({
    nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres").max(80, "Máximo 80 caracteres"),
    valor: z.string().regex(/^\d+(\.\d{1,2})?$/, "Valor inválido (ex: 150.50)").refine((val) => parseFloat(val) > 0, "O valor deve ser maior que zero"),
    loja: z.enum(["JOAO_PESSOA", "SANTA_RITA", "AMBAS"]),
    dia_venc: z.coerce.number().int().min(1, "Dia inválido").max(31, "Dia inválido"),
});

export const EditarCustoFixoSchema = CriarCustoFixoSchema.extend({
    id: z.string().uuid("ID inválido"),
});

// ─── Fase 8: Configurações, Usuários ─────────────────────────────────────────

// PIN helper reutilizável
const PinField = z.string().length(4, "O PIN deve ter 4 dígitos.").regex(/^\d+$/, "Apenas números");

export const TrocarPinSchema = z.object({
    pinAtual: PinField,
    novoPin: PinField,
    confirmarPin: PinField,
}).refine((data) => data.novoPin === data.confirmarPin, {
    message: 'Os PINs não conferem.',
    path: ['confirmarPin'],
}).refine((data) => data.pinAtual !== data.novoPin, {
    message: 'O novo PIN deve ser diferente do atual.',
    path: ['novoPin'],
});

export const AlterarSenhaSchema = z.object({
    senhaAtual: z.string().min(6, "Senha precisa ter no mínimo 6 caracteres."),
    novaSenha: z.string().min(6, "Senha precisa ter no mínimo 6 caracteres."),
    confirmarSenha: z.string().min(6, "Confirmação precisa ter no mínimo 6 caracteres."),
}).refine((data) => data.novaSenha === data.confirmarSenha, {
    message: 'As senhas não conferem.',
    path: ['confirmarSenha'],
}).refine((data) => data.senhaAtual !== data.novaSenha, {
    message: 'A nova senha deve ser diferente da atual.',
    path: ['novaSenha'],
});

export const AtualizarNotificacoesSchema = z.object({
    notif_push: z.boolean(),
    notif_horario: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato inválido (HH:MM)"),
});

export const EditarUsuarioLojaSchema = z.object({
    userId: z.string().uuid("ID de usuário inválido"),
    lojaAutorizada: LojasEnum,
});

export const EditarUsuarioAtivoSchema = z.object({
    userId: z.string().uuid("ID de usuário inválido"),
    ativo: z.boolean(),
});

export const EditarLojaPadraoSchema = z.object({
    lojaPadrao: LojasEnum.nullable(),
});

export const EditarUsuarioSchema = z.object({
    userId: z.string().uuid("ID de usuário inválido"),
    lojaAutorizada: LojasEnum,
    ativo: z.boolean(),
    role: RolesEnum.optional(),
});

export const ExcluirUsuarioSchema = z.object({
    userId: z.string().uuid("ID de usuário inválido"),
});

export const CriarUsuarioSchema = z.object({
    nome: z.string().min(2, "Nome deve ter ao menos 2 caracteres.").max(80),
    email: z.string().email("E-mail inválido."),
    senha: z.string().min(8, "Senha deve ter ao menos 8 caracteres."),
    role: z.enum(["ADMIN", "OPERADOR"]),
    lojaAutorizada: LojasEnum,
});
