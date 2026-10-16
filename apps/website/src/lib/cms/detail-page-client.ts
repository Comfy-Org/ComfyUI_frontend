import { modelsPageDataSchema } from '@/config/models-page-data'
import { catalogDetailPath } from './detail-route'

export async function fetchCatalogDetail(
  path: string,
  locale: string,
  signal: AbortSignal
) {
  if (!catalogDetailPath(path)) throw new Error('Invalid content route')
  const canonical = path.replace(/^\/zh-CN/, '').replace(/\/$/, '')
  const slug = canonical.replace(/^\/hub\//, '').replace(/^models\//, '')
  const url = new URL(`/models/${slug}/page.json`, location.origin)
  url.searchParams.set('path', canonical)
  url.searchParams.set('locale', locale)
  const response = await fetch(url, {
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(response.status === 404 ? 'not-found' : 'unavailable')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('unavailable')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > 4 * 1024 * 1024) {
        await reader.cancel()
        throw new Error('unavailable')
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  const page = modelsPageDataSchema.parse(
    JSON.parse(new TextDecoder().decode(bytes))
  )
  if (page.model.href.replace(/\/$/, '') !== canonical)
    throw new Error('Content route mismatch')
  return page
}
