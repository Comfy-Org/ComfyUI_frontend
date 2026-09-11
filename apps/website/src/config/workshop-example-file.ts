import type { FileValue } from './workshop-playground'
import { isHttpImageSource } from './workshop-image-source'

const MIME_TYPES = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp'],
  ['mp4', 'video/mp4'],
  ['webm', 'video/webm'],
  ['mov', 'video/quicktime'],
  ['mp3', 'audio/mpeg'],
  ['wav', 'audio/wav'],
  ['m4a', 'audio/mp4']
])
const files = new WeakMap<FileValue, File>()
const MAX_BYTES = 7 * 1024 * 1024

export function workshopExampleFile(
  source: string,
  fallbackType = 'application/octet-stream'
): FileValue | undefined {
  if (!isHttpImageSource(source)) return
  const name = new URL(source).pathname.split('/').at(-1) || 'example'
  const type =
    MIME_TYPES.get(name.split('.').at(-1)?.toLowerCase() ?? '') ?? fallbackType
  return { name, type, size: 0, previewUrl: source, sourceUrl: source }
}

export function workshopExampleFiles(
  source: string | readonly string[],
  multiple = false,
  fallbackType?: string
): FileValue | FileValue[] | undefined {
  const urls = typeof source === 'string' ? [source] : source
  const result: FileValue[] = []
  for (const url of urls) {
    const file = workshopExampleFile(url, fallbackType)
    if (!file) return
    result.push(file)
  }
  if (!result.length || (!multiple && result.length > 1)) return
  return multiple ? result : result[0]
}

export async function loadWorkshopExampleFile(
  value: FileValue,
  signal: AbortSignal
): Promise<File> {
  signal.throwIfAborted()
  const cached = files.get(value)
  if (cached) return cached
  if (!value.sourceUrl || !workshopExampleFile(value.sourceUrl))
    throw new Error('Invalid example media URL')
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(30_000)])
  const response = await fetch(value.sourceUrl, {
    signal: requestSignal,
    credentials: 'omit',
    redirect: 'error'
  })
  if (
    !response.ok ||
    Number(response.headers.get('Content-Length')) > MAX_BYTES
  ) {
    await response.body?.cancel()
    throw new Error('Example media unavailable or too large')
  }
  const type =
    response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ??
    ''
  if (![...MIME_TYPES.values()].includes(type)) {
    await response.body?.cancel()
    throw new Error('Invalid example media type')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty example media')
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let bytes = 0
  try {
    for (;;) {
      requestSignal.throwIfAborted()
      const { done, value: chunk } = await reader.read()
      if (done) break
      bytes += chunk.byteLength
      if (bytes > MAX_BYTES) throw new Error('Example media too large')
      chunks.push(new Uint8Array(chunk))
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  signal.throwIfAborted()
  if (!bytes) throw new Error('Empty example media')
  const file = new File(chunks, value.name, { type })
  files.set(value, file)
  return file
}
