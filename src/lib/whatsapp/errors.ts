/**
 * WhatsApp API Error Handling
 *
 * Consolidated error class for consistent error handling across all WhatsApp endpoints.
 * Prevents internal detail leakage and provides typed error codes.
 */

/**
 * Error codes returned by WhatsApp API handlers
 */
export type WhatsAppErrorCode =
  | 'MEDIA_NOT_FOUND'
  | 'UPLOAD_FAILED'
  | 'SIZE_EXCEEDED'
  | 'UNSUPPORTED_MIME'
  | 'INVALID_PARAMS'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'

/**
 * Mapping of error codes to HTTP status codes
 */
const ERROR_CODE_TO_STATUS: Record<WhatsAppErrorCode, number> = {
  MEDIA_NOT_FOUND: 404,
  UPLOAD_FAILED: 502,
  SIZE_EXCEEDED: 400,
  UNSUPPORTED_MIME: 400,
  INVALID_PARAMS: 400,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
}

/**
 * WhatsApp error class with typed error codes and status codes
 *
 * @example
 * throw new WhatsAppError(
 *   'UPLOAD_FAILED',
 *   'O WhatsApp recusou o envio. Verifique o arquivo e tente novamente.',
 *   502
 * )
 */
export class WhatsAppError extends Error {
  public readonly code: WhatsAppErrorCode
  public readonly statusCode: number
  public readonly userMessage: string

  /**
   * Creates a new WhatsApp error
   *
   * @param code - Error code (typed)
   * @param message - User-facing error message (never exposes internals)
   * @param statusCode - HTTP status code (default: inferred from code)
   */
  constructor(
    code: WhatsAppErrorCode,
    message: string,
    statusCode?: number
  ) {
    super(message)
    this.code = code
    this.userMessage = message
    this.statusCode = statusCode ?? ERROR_CODE_TO_STATUS[code]
    this.name = 'WhatsAppError'

    // Maintain prototype chain
    Object.setPrototypeOf(this, WhatsAppError.prototype)
  }

  /**
   * Converts to JSON response format for API responses
   *
   * @returns Object suitable for Response.json()
   */
  toJSON() {
    return {
      error: this.userMessage,
      code: this.code,
      status: this.statusCode,
    }
  }
}

/**
 * Type guard to check if an error is a WhatsAppError
 *
 * @param error - Error to check
 * @returns true if error is WhatsAppError
 */
export function isWhatsAppError(error: unknown): error is WhatsAppError {
  return error instanceof WhatsAppError
}

/**
 * Turns a Meta/WhatsApp error into a message the team can understand,
 * without returning the technical detail (that stays in the server log).
 * Codes: https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export function mensagemErroWhatsApp(error: unknown, padrao: string): string {
  const texto = error instanceof Error ? error.message : String(error)
  const codigo = Number(texto.match(/"code"\s*:\s*(\d+)/)?.[1])
  switch (codigo) {
    case 131047:
      return 'Passaram 24 h desde a última mensagem do cliente: use um modelo (template).'
    case 132000:
    case 132001:
    case 132012:
      return 'O modelo não está aprovado pela Meta ou os campos estão errados.'
    case 131026:
      return 'O número não pode receber mensagens no WhatsApp.'
    case 130429:
    case 131048:
    case 131056:
      return 'Muitas mensagens em pouco tempo. Aguarde um pouco e tente de novo.'
    case 190:
      return 'A conexão com o WhatsApp expirou. Avise o administrador.'
    default:
      return padrao
  }
}

/**
 * Handles any error and returns a safe response
 *
 * Converts WhatsAppError to typed response, other errors to generic message.
 * Never exposes internal error details to clients.
 *
 * @param error - Error to handle
 * @returns Response.json compatible object with status
 */
export function handleWhatsAppError(error: unknown): {
  body: ReturnType<WhatsAppError['toJSON']> | { error: string }
  status: number
} {
  if (isWhatsAppError(error)) {
    return {
      body: error.toJSON(),
      status: error.statusCode,
    }
  }

  // Log the actual error for debugging (server-side only)
  console.error('[whatsapp-error]', error instanceof Error ? error.message : String(error))

  // Return generic error to client
  return {
    body: { error: 'Erro interno ao processar sua solicitação. Tente novamente em instantes.' },
    status: 500,
  }
}
