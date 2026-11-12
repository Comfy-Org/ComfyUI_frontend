import type {
  DownscaleRequest,
  DownscaleResponse
} from './downscaleImageMessages'

async function isAnimated(blob: Blob): Promise<boolean> {
  if (typeof ImageDecoder === 'undefined') return blob.type === 'image/gif'
  const decoder = new ImageDecoder({ data: blob.stream(), type: blob.type })
  try {
    await decoder.tracks.ready
    return decoder.tracks.selectedTrack?.animated ?? false
  } finally {
    decoder.close()
  }
}

async function downscale({
  source,
  maxEdge
}: DownscaleRequest): Promise<DownscaleResponse['result']> {
  const response = await fetch(source)
  if (!response.ok) return undefined
  const blob = await response.blob()
  const full = await createImageBitmap(blob)
  const originalSize = { width: full.width, height: full.height }
  try {
    const scale = maxEdge / Math.max(full.width, full.height)
    if (scale >= 1 || (await isAnimated(blob))) return { originalSize }

    const canvas = new OffscreenCanvas(
      Math.round(full.width * scale),
      Math.round(full.height * scale)
    )
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(full, 0, 0, canvas.width, canvas.height)
    const copy = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.9
    })
    return { originalSize, blob: copy }
  } finally {
    full.close()
  }
}

self.onmessage = async (event: MessageEvent<DownscaleRequest>) => {
  const result = await downscale(event.data).catch(() => undefined)
  const message: DownscaleResponse = { id: event.data.id, result }
  self.postMessage(message)
}
