import type { RunOutput } from './workshop-run'
import { rasterizeSvgImage } from './workshop-svg-rasterizer'

export type WorkshopSvgRasterizer = (
  svg: string,
  signal?: AbortSignal
) => Promise<Blob>

async function browserRasterizer(svg: string, signal?: AbortSignal) {
  const png = await rasterizeSvgImage({ svg, signal })
  return (await fetch(png, { signal })).blob()
}

async function downloadSvg(url: string, signal: AbortSignal): Promise<Blob> {
  const response = await fetch(url, {
    signal,
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer'
  })
  if (!response.ok || !response.body) throw new Error('SVG download failed')
  const reader = response.body.getReader()
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let length = 0
  try {
    if (Number(response.headers.get('Content-Length')) > 4 * 1024 * 1024)
      throw new Error('SVG exceeds the byte limit')
    for (;;) {
      signal.throwIfAborted()
      const { value, done } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > 4 * 1024 * 1024)
        throw new Error('SVG exceeds the byte limit')
      chunks.push(new Uint8Array(value))
    }
    if (!length) throw new Error('Empty SVG output')
    return new Blob(chunks, { type: 'application/octet-stream' })
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

export async function svgOutputs(
  source: string | Blob,
  fileName: string,
  signal?: AbortSignal,
  rasterize: WorkshopSvgRasterizer = browserRasterizer
): Promise<RunOutput[]> {
  signal?.throwIfAborted()
  if (typeof source === 'string') {
    const parsed = URL.parse(source)
    if (
      !parsed ||
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password
    )
      throw new Error('Unsafe SVG URL')
  }
  const requestSignal = AbortSignal.any([
    ...(signal ? [signal] : []),
    AbortSignal.timeout(10_000)
  ])
  requestSignal.throwIfAborted()
  let svg: Blob
  try {
    svg =
      typeof source === 'string'
        ? await downloadSvg(source, requestSignal)
        : source.slice(0, source.size, 'application/octet-stream')
  } catch (error) {
    signal?.throwIfAborted()
    if (typeof source !== 'string') throw error
    return [{ kind: 'other', url: source, fileName }]
  }
  if (svg.size > 4 * 1024 * 1024) throw new Error('SVG exceeds the byte limit')
  const original: RunOutput = {
    kind: 'other',
    url: URL.createObjectURL(svg),
    byteLength: svg.size,
    fileName
  }
  try {
    const png = await rasterize(await svg.text(), requestSignal)
    requestSignal.throwIfAborted()
    if (png.type !== 'image/png' || !png.size || png.size > 36 * 1024 * 1024)
      throw new Error('Invalid rasterized image')
    return [
      {
        kind: 'image',
        url: URL.createObjectURL(png),
        byteLength: png.size,
        fileName: fileName.replace(/\.svg$/, '') + '.png'
      },
      original
    ]
  } catch (error) {
    if (signal?.aborted) {
      URL.revokeObjectURL(original.url)
      throw error
    }
    return [original]
  }
}
