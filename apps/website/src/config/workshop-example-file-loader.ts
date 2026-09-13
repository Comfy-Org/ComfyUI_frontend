import type { FileValue } from './workshop-playground'

import {
  WORKSHOP_EXAMPLE_MIME_TYPES,
  workshopExampleFile
} from './workshop-example-file'

const files = new WeakMap<FileValue, File>()
const MAX_BYTES = 7 * 1024 * 1024

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
  if (![...WORKSHOP_EXAMPLE_MIME_TYPES.values()].includes(type)) {
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
