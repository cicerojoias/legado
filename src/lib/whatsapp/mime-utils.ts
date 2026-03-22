/**
 * MIME type utilities for WhatsApp media handling
 *
 * Centralizes MIME type to WhatsApp media type conversion.
 * Replaces scattered logic across 4 files with a single source of truth.
 */

/**
 * WhatsApp supported media types
 */
export type WhatsAppMediaType = 'image' | 'audio' | 'document' | 'video'

/**
 * Map of MIME types to WhatsApp media types
 * Covers all supported MIME types in the application
 */
const MIME_TO_WA_TYPE: Record<string, WhatsAppMediaType> = {
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',

  // Audio
  'audio/mpeg': 'audio',
  'audio/mp4': 'audio',
  'audio/webm': 'audio',
  'audio/ogg': 'audio',

  // Video
  'video/mp4': 'video',

  // Documents
  'application/pdf': 'document',
}

/**
 * Converts a MIME type to WhatsApp media type
 *
 * Handles MIME type normalization (strips codec information like "; codecs=opus")
 * and returns a safe default (document) for unknown types.
 *
 * @param mimeType - Raw MIME type (may contain codec info)
 * @returns WhatsApp media type (image, audio, video, or document)
 *
 * @example
 * getWhatsAppMediaType('audio/ogg; codecs=opus') // 'audio'
 * getWhatsAppMediaType('image/jpeg') // 'image'
 * getWhatsAppMediaType('application/unknown') // 'document'
 */
export function getWhatsAppMediaType(mimeType: string): WhatsAppMediaType {
  if (!mimeType) return 'document'

  // Normalize: remove codec information
  // e.g., "audio/ogg; codecs=opus" → "audio/ogg"
  const normalized = mimeType.split(';')[0].trim()

  // Look up in map, default to 'document' for safety
  return MIME_TO_WA_TYPE[normalized] ?? 'document'
}

/**
 * Checks if a MIME type is supported for WhatsApp
 *
 * @param mimeType - MIME type to check
 * @returns true if MIME type is in the allowed list
 */
export function isSupportedMimeType(mimeType: string): boolean {
  const normalized = mimeType.split(';')[0].trim()
  return normalized in MIME_TO_WA_TYPE
}

/**
 * Gets a human-readable display name for a media type
 *
 * @param mediaType - WhatsApp media type
 * @returns Portuguese display name (for UI)
 */
export function getMediaTypeDisplayName(mediaType: WhatsAppMediaType): string {
  const names: Record<WhatsAppMediaType, string> = {
    image: 'Imagem',
    audio: 'Áudio',
    video: 'Vídeo',
    document: 'Arquivo',
  }
  return names[mediaType]
}
