import type { PlankPreviewSyncWebhookPayload } from './types.js'

export function isPlankPreviewSyncWebhookPayload(
  value: unknown,
): value is PlankPreviewSyncWebhookPayload {
  if (!value || typeof value !== 'object') return false

  const data = value as Record<string, unknown>

  return (
    data.event === 'preview.sync' &&
    typeof data.content_type === 'string' &&
    typeof data.entry_id === 'string' &&
    typeof data.triggered_at === 'string' &&
    (typeof data.status === 'string' || data.status === null) &&
    (typeof data.slug === 'string' || data.slug === null) &&
    (typeof data.preview_url === 'string' || data.preview_url === null)
  )
}
