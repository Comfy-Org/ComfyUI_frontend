import type { FileValue } from './workshop-playground'
import { isHttpImageSource } from './workshop-image-source'

const MIME_TYPES = new Map([
  ['png', 'image/png'],
  ['jpg', 'image/jpeg'],
  ['jpeg', 'image/jpeg'],
  ['webp', 'image/webp']
])
const files = new WeakMap<FileValue, File>()
const MAX_BYTES = 7 * 1024 * 1024

export function workshopExampleFile(source: string): FileValue | undefined {
  if (!isHttpImageSource(source)) return
  const name = new URL(source).pathname.split('/').at(-1)
  const type = MIME_TYPES.get(name?.split('.').at(-1)?.toLowerCase() ?? '')
  if (!name || !type) return
  return { name, type, size: 0, previewUrl: source, sourceUrl: source }
}

export async function loadWorkshopExampleFile(
  value: FileValue,
  signal: AbortSignal
): Promise<File> {
  signal.throwIfAborted()
  const cached = files.get(value)
  if (cached) return cached
  if (!value.sourceUrl || !workshopExampleFile(value.sourceUrl))
    throw new Error('Invalid example image URL')
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
    throw new Error('Example image unavailable or too large')
  }
  const type =
    response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ??
    ''
  if (![...MIME_TYPES.values()].includes(type)) {
    await response.body?.cancel()
    throw new Error('Invalid example image type')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Empty example image')
  const chunks: Uint8Array<ArrayBuffer>[] = []
  let bytes = 0
  try {
    for (;;) {
      requestSignal.throwIfAborted()
      const { done, value: chunk } = await reader.read()
      if (done) break
      bytes += chunk.byteLength
      if (bytes > MAX_BYTES) throw new Error('Example image too large')
      chunks.push(new Uint8Array(chunk))
    }
  } catch (error) {
    await reader.cancel().catch(() => {})
    throw error
  } finally {
    reader.releaseLock()
  }
  signal.throwIfAborted()
  if (!bytes) throw new Error('Empty example image')
  const file = new File(chunks, value.name, { type })
  files.set(value, file)
  return file
}
