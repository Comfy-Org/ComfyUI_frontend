import { z } from 'astro/zod'
import { modelSchema } from '@/config/models-catalogue-data'
import { USE_CASES } from '@/config/models-catalogue'

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const facet = z.object({
  value: z.string(),
  label: z.string().optional(),
  count: count.optional()
})
const page = z.object({
  page: count.min(1),
  pageSize: count.min(1).max(100),
  total: count.optional(),
  totalPages: count.optional(),
  hasPrevious: z.boolean(),
  hasNext: z.boolean(),
  mode: z.literal('cursor').optional(),
  count: count.optional(),
  nextCursor: z.string().max(8192).optional(),
  previousCursor: z.string().max(8192).optional(),
  available: z.boolean().optional(),
  reset: z.boolean().optional()
})
export const cataloguePageSchema = z.object({
  models: modelSchema.array().max(24),
  pages: z.object({ models: page, workflows: page, apps: page }),
  facets: z.object({
    models: z.object({
      useCases: z
        .object({ value: z.enum(USE_CASES), count: count.optional() })
        .array()
        .max(2000),
      sortOrders: z
        .enum(['popular', 'name', 'priceAsc', 'priceDesc'])
        .array()
        .max(4)
    }),
    workflows: z.object({
      categories: facet.extend({ label: z.string() }).array().max(2000),
      models: facet.array().max(2000)
    })
  })
})

export async function fetchCataloguePage(url: URL, signal: AbortSignal) {
  const response = await fetch(url, {
    signal,
    credentials: 'same-origin',
    cache: 'no-store',
    redirect: 'error',
    headers: { Accept: 'application/json' }
  })
  const limit = 512 * 1024
  if (!response.ok || Number(response.headers.get('Content-Length')) > limit) {
    await response.body?.cancel()
    throw new Error('Catalog page unavailable')
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Catalog page unavailable')
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > limit) {
        await reader.cancel()
        throw new Error('Catalog page too large')
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
  return cataloguePageSchema.parse(JSON.parse(new TextDecoder().decode(bytes)))
}
