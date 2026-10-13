import { randomUUID } from 'node:crypto'

import type { SeedEntry } from './mock-ingest'
import { MOCK_CREDENTIAL, createMockIngest } from './mock-ingest'

/**
 * The shareable design demo: a preview build whose site API is the in-memory
 * mock rather than the ingest service, so the admin runs on a plain Vercel
 * preview with sample data and no credentials. Never on production.
 */
export const demoMode = () =>
  process.env.SITE_CATALOG_DEMO === '1' &&
  process.env.VERCEL_ENV !== 'production'

type Ingest = ReturnType<typeof createMockIngest>

const MAX_SANDBOXES = 200
const sandboxes = new Map<string, Ingest>()
let seed: SeedEntry[] | undefined

async function demoSeed() {
  if (!seed) {
    const { entries } = await import('@website/scripts/export-cms-seed')
    // Through JSON, exactly as `pnpm dev:cms` hands the mock its seed file.
    seed = JSON.parse(JSON.stringify(entries)) as SeedEntry[]
  }
  return seed
}

/** Each visitor signs in to a sandbox of their own, so one person publishing
 * does not empty the Draft for the next person who opens the link. */
export const newDemoCredential = () => `${MOCK_CREDENTIAL}.${randomUUID()}`

async function sandboxFor(authorization: string | null) {
  const key = authorization?.replace(/^Bearer /, '') ?? ''
  const known = sandboxes.get(key)
  if (known) return known
  const ingest = createMockIngest(await demoSeed())
  if (sandboxes.size >= MAX_SANDBOXES)
    sandboxes.delete(sandboxes.keys().next().value ?? '')
  sandboxes.set(key, ingest)
  return ingest
}

export async function catalogFetch(url: URL, init: RequestInit = {}) {
  if (!demoMode()) return fetch(url, init)
  const authorization = new Headers(init.headers).get('authorization')
  const valid = authorization?.startsWith(`Bearer ${MOCK_CREDENTIAL}.`)
  const route = await sandboxFor(valid ? authorization : null)
  const [status, body] = route(
    init.method ?? 'GET',
    url,
    valid ? `Bearer ${MOCK_CREDENTIAL}` : authorization,
    typeof init.body === 'string' ? init.body : ''
  )
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}
