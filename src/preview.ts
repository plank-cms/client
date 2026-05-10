import type { PlankPreviewBridgeOptions, PlankPreviewSyncMessage } from './types.js'

export function attachPlankPreviewBridge({
  allowedOrigin,
  onSync,
}: PlankPreviewBridgeOptions): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  function handleMessage(event: MessageEvent) {
    if (event.origin !== allowedOrigin) return
    if (!isPreviewSyncMessage(event.data)) return

    if (onSync) {
      onSync(event.data)
      return
    }

    const incomingUrl = normalizeUrl(event.data.url)
    const currentUrl = normalizeUrl(window.location.href)

    if (!incomingUrl || !currentUrl) return

    if (incomingUrl !== currentUrl) {
      window.location.assign(incomingUrl)
      return
    }

    window.location.reload()
  }

  window.addEventListener('message', handleMessage)

  return () => {
    window.removeEventListener('message', handleMessage)
  }
}

function isPreviewSyncMessage(value: unknown): value is PlankPreviewSyncMessage {
  if (!value || typeof value !== 'object') return false

  const data = value as Record<string, unknown>

  return (
    data.source === 'plank-preview' &&
    data.type === 'plank.preview.sync' &&
    typeof data.url === 'string'
  )
}

function normalizeUrl(url: string): string | null {
  try {
    return new URL(url, window.location.href).toString()
  } catch {
    return null
  }
}
