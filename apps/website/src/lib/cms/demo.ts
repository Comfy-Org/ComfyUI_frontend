import type { SeedEntry } from './mock-ingest'
import { createMockIngest } from './mock-ingest'

/**
 * The shareable design demo: a preview build whose site API is the in-memory
 * mock rather than the ingest service, so the admin runs on a plain Vercel
 * preview with sample data and no credentials. Never on production.
 */
export const demoMode = () =>
  process.env.SITE_CATALOG_DEMO === '1' &&
  process.env.VERCEL_ENV !== 'production'

let ingest: ReturnType<typeof createMockIngest> | undefined

async function demoIngest() {
  if (!ingest) {
    const { entries } = await import('@website/scripts/export-cms-seed')
    // Through JSON, exactly as `pnpm dev:cms` hands the mock its seed file.
    const seed: SeedEntry[] = JSON.parse(JSON.stringify(entries))
    ingest = createMockIngest(seed)
  }
  return ingest
}

export async function catalogFetch(url: URL, init: RequestInit = {}) {
  if (!demoMode()) return fetch(url, init)
  const route = await demoIngest()
  const [status, body] = route(
    init.method ?? 'GET',
    url,
    new Headers(init.headers).get('authorization'),
    typeof init.body === 'string' ? init.body : ''
  )
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
