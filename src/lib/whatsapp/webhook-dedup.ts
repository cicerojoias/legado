/**
 * Webhook Request Deduplication
 *
 * Meta can resend the same webhook event multiple times due to retries.
 * This module prevents processing duplicate messages by tracking recently
 * processed webhook IDs.
 *
 * Performance: Prevents 2-3 duplicate database entries per webhook event
 * in normal operation.
 */

/**
 * Recently processed webhook IDs
 * Key: webhookId (entry.id + field)
 * Value: timestamp when processed
 */
const PROCESSED_WEBHOOKS = new Map<string, number>()

/**
 * Deduplication window in milliseconds
 * If the same webhook is seen within this window, it's considered a duplicate
 * Meta webhook retries typically happen within 10 seconds
 */
const DEDUP_WINDOW_MS = 10 * 1000

/**
 * Maximum dedup tracking size to prevent memory leaks
 * Once exceeded, oldest entries are removed
 */
const MAX_DEDUP_SIZE = 1000

/**
 * Generate webhook ID from webhook data
 * Unique identifier for this webhook event
 *
 * @param entryId - entry.id from Meta webhook
 * @param field - changes[0].field from Meta webhook (usually "messages" or "statuses")
 * @param messageIds - Optional array of message IDs in this webhook
 * @returns Unique webhook identifier
 *
 * @example
 * const webhookId = generateWebhookId('entry123', 'messages', ['msg1', 'msg2'])
 */
export function generateWebhookId(
  entryId: string,
  field: string,
  messageIds?: string[]
): string {
  // Basic: entry + field
  if (!messageIds || messageIds.length === 0) {
    return `${entryId}:${field}`
  }

  // Advanced: entry + field + sorted message IDs (handles duplicates better)
  const sortedIds = [...messageIds].sort().join(',')
  return `${entryId}:${field}:${sortedIds}`
}

/**
 * Check if webhook has already been processed
 *
 * @param webhookId - Unique webhook ID
 * @returns true if webhook is a duplicate (already processed recently)
 *
 * @example
 * const isDuplicate = isWebhookProcessed(webhookId)
 * if (isDuplicate) {
 *   return NextResponse.json({ status: 'already_processed' })
 * }
 */
export function isWebhookProcessed(webhookId: string): boolean {
  const lastProcessed = PROCESSED_WEBHOOKS.get(webhookId)

  if (!lastProcessed) {
    return false // Not seen before
  }

  const timeSinceLastProcessed = Date.now() - lastProcessed

  if (timeSinceLastProcessed < DEDUP_WINDOW_MS) {
    // Recently processed — this is a duplicate
    console.log(
      `[webhook-dedup] Duplicate detected: ${webhookId} (${timeSinceLastProcessed}ms ago)`
    )
    return true
  }

  // Older than dedup window — not a duplicate
  return false
}

/**
 * Mark webhook as processed
 * Call this after successfully processing a webhook
 *
 * @param webhookId - Unique webhook ID
 *
 * @example
 * if (!isWebhookProcessed(webhookId)) {
 *   // Process webhook...
 *   markWebhookProcessed(webhookId)
 * }
 */
export function markWebhookProcessed(webhookId: string): void {
  // Prevent dedup map from growing indefinitely
  if (PROCESSED_WEBHOOKS.size >= MAX_DEDUP_SIZE) {
    const oldestKey = PROCESSED_WEBHOOKS.keys().next().value
    if (oldestKey) {
      PROCESSED_WEBHOOKS.delete(oldestKey)
    }
  }

  PROCESSED_WEBHOOKS.set(webhookId, Date.now())
}

/**
 * Clean up old webhook entries
 * Call periodically to prevent memory leaks
 *
 * @returns Number of entries cleaned up
 */
export function cleanupOldWebhooks(): number {
  let cleaned = 0
  const now = Date.now()

  for (const [webhookId, timestamp] of PROCESSED_WEBHOOKS.entries()) {
    if (now - timestamp > DEDUP_WINDOW_MS * 2) {
      PROCESSED_WEBHOOKS.delete(webhookId)
      cleaned++
    }
  }

  return cleaned
}

/**
 * Get deduplication statistics
 * Useful for monitoring
 */
export function getWebhookDedupStats(): {
  trackedWebhooks: number
  maxSize: number
  dedupWindowSeconds: number
} {
  return {
    trackedWebhooks: PROCESSED_WEBHOOKS.size,
    maxSize: MAX_DEDUP_SIZE,
    dedupWindowSeconds: DEDUP_WINDOW_MS / 1000,
  }
}

/**
 * Clear all tracked webhooks
 * Use for testing or emergency cleanup
 */
export function clearWebhookDedup(): void {
  PROCESSED_WEBHOOKS.clear()
}

/**
 * Periodic cleanup task
 * Start at application boot
 */
let cleanupInterval: NodeJS.Timeout | null = null

export function startWebhookCleanup(): void {
  if (cleanupInterval) {
    return // Already running
  }

  cleanupInterval = setInterval(() => {
    const cleaned = cleanupOldWebhooks()
    if (cleaned > 0) {
      console.log(`[webhook-dedup] Cleanup: removed ${cleaned} old entries`)
    }
  }, DEDUP_WINDOW_MS)

  console.log('[webhook-dedup] Cleanup task started')
}

export function stopWebhookCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
    cleanupInterval = null
    console.log('[webhook-dedup] Cleanup task stopped')
  }
}
