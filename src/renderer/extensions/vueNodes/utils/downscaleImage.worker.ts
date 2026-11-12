import type {
  DownscaleRequest,
  DownscaleResponse
} from './downscaleImageMessages'
import { isAnimatedImage } from './imageAnimation'

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
    if (scale >= 1 || isAnimatedImage(new Uint8Array(await blob.arrayBuffer())))
      return { originalSize }

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

let queue = Promise.resolve()

self.onmessage = (event: MessageEvent<DownscaleRequest>) => {
  queue = queue.then(async () => {
    const result = await downscale(event.data).catch(() => undefined)
    const message: DownscaleResponse = { id: event.data.id, result }
    self.postMessage(message)
  })
}
