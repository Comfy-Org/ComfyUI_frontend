import type {
  DownscaleRequest,
  DownscaleResponse
} from './downscaleImageMessages'

async function downscale({
  source,
  maxEdge
}: DownscaleRequest): Promise<DownscaleResponse['result']> {
  const response = await fetch(source)
  if (!response.ok) return undefined
  const full = await createImageBitmap(await response.blob())
  const originalSize = { width: full.width, height: full.height }
  try {
    const scale = maxEdge / Math.max(full.width, full.height)
    if (scale >= 1) return { originalSize }

    const canvas = new OffscreenCanvas(
      Math.round(full.width * scale),
      Math.round(full.height * scale)
    )
    const ctx = canvas.getContext('2d')
    if (!ctx) return undefined
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(full, 0, 0, canvas.width, canvas.height)
    const blob = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.9
    })
    return { originalSize, blob }
  } finally {
    full.close()
  }
}

self.onmessage = async (event: MessageEvent<DownscaleRequest>) => {
  const result = await downscale(event.data).catch(() => undefined)
  const message: DownscaleResponse = { id: event.data.id, result }
  self.postMessage(message)
}
