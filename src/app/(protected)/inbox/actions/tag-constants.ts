export const TAG_COLORS = [
  'amber', 'rose', 'sky', 'violet', 'orange',
  'teal', 'pink', 'indigo', 'lime', 'cyan',
] as const

export type TagColor = typeof TAG_COLORS[number]

export type TagActionResult =
  | { success: true; tag?: import('@prisma/client').WaTag }
  | { success: false; code: 'NAO_AUTORIZADO' | 'CAMPOS_INVALIDOS' | 'NOME_DUPLICADO' | 'TAG_EM_USO' | 'ERRO_INTERNO'; message?: string }
