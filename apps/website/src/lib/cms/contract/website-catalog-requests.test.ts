// @vitest-environment node
import { createContext } from 'astro/middleware'
import { describe, expect, it, vi } from 'vitest'

import { AUTHORING_CSRF_COOKIE } from '@/lib/cms/authoring-session'
import type { AuthoringSession } from '@/lib/cms/authoring-session'
import { loadSiteCatalog } from '@/lib/cms/catalog'
import { loadSiteCatalogList } from '@/lib/cms/catalog-list'
import { savePayload } from '@/lib/cms/editor-document'
import {
  checkedReviewPayload,
  publicationPayload
} from '@/lib/cms/staging-review'
import { POST as catalogAPI } from '@/routes/admin/catalog-api'
import { POST as contentAPI } from '@/routes/admin/content-api'

/**
 * The website's real requests to the catalog backend, captured from the
 * website's own payload builders and server routes (not hand-written), for the
 * Cloud ingest contract test (services/ingest/server/implementation/
 * ccc_website_contract_test.go) to replay against the Go handlers.
 *
 * Values that come from earlier responses are recorded as placeholders the Go
 * test fills from the live responses: {{draft_rev}}, {{live_rev}},
 * {{draft_generation}}, {{uid}}, {{revision_uid}}, {{selection_digest}} and
 * {{idempotency_key}}. Update the fixture with `vitest -u` and copy it to
 * services/ingest/server/implementation/testdata/website-catalog-requests.json
 * in the Cloud repo.
 */

const ORIGIN = 'http://catalog.example'
const CSRF = 'a'.repeat(64)
// Sentinels the placeholders replace. Numbers stay distinct and unusual so a
// replacement can never hit an unrelated value.
const DRAFT_REV = 70001
const LIVE_REV = 70000
const GENERATION = 70002
const UID = '00000000-0000-4000-8000-00000000c0de'
const REVISION_UID = '00000000-0000-4000-8000-00000000beef'
const DIGEST = 'd'.repeat(64)
const KEY = 'website-contract-idempotency-key'
const SLUG = 'website-contract-fixture'

const session: AuthoringSession = {
  credential: 'server-only-fixture',
  csrf: CSRF,
  actor_uid: '00000000-0000-4000-8000-000000000004',
  owner_uid: '00000000-0000-4000-8000-000000000001',
  can_edit: true,
  can_apply: true,
  state: {
    draft_rev: DRAFT_REV,
    live_rev: LIVE_REV,
    next_rev: DRAFT_REV + 1,
    draft_generation: GENERATION,
    previous_live_rev: null
  }
}

// What the editor holds for a new public Hub workflow before Save.
const document = {
  title: 'Website contract fixture',
  description: 'Created by the website contract test',
  slug: SLUG,
  enabled: true,
  visibility: 'public',
  available_surfaces: ['hub'],
  tags: ['contract']
}

interface Captured {
  name: string
  method: string
  path: string
  query: [string, string][]
  headers: Record<string, string>
  body?: unknown
}

function routeContext(route: string, operation: string, body: unknown) {
  const ctx = createContext({
    request: new Request(
      `https://website.example/admin/${route}/${operation}`,
      {
        method: 'POST',
        headers: {
          Origin: 'https://website.example',
          'X-Comfy-CSRF': CSRF,
          'Idempotency-Key': KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    ),
    defaultLocale: 'en',
    clientAddress: '127.0.0.1'
  })
  ctx.params.operation = operation
  ctx.cookies.set(AUTHORING_CSRF_COOKIE, CSRF)
  ctx.locals.catalogAuthoring = session
  return ctx
}

const placeholders: [RegExp, string][] = [
  [new RegExp(`"${UID}"`, 'g'), '"{{uid}}"'],
  [new RegExp(`"${REVISION_UID}"`, 'g'), '"{{revision_uid}}"'],
  [new RegExp(`"${DIGEST}"`, 'g'), '"{{selection_digest}}"'],
  [new RegExp(`"${KEY}"`, 'g'), '"{{idempotency_key}}"'],
  [new RegExp(`\\b${DRAFT_REV}\\b`, 'g'), '"{{draft_rev}}"'],
  [new RegExp(`\\b${LIVE_REV}\\b`, 'g'), '"{{live_rev}}"'],
  [new RegExp(`\\b${GENERATION}\\b`, 'g'), '"{{draft_generation}}"']
]

function withPlaceholders(value: unknown): unknown {
  let text = JSON.stringify(value)
  for (const [pattern, replacement] of placeholders)
    text = text.replace(pattern, replacement)
  return JSON.parse(text)
}

async function capture(name: string, run: () => unknown) {
  const calls: Captured[] = []
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    const headers: Record<string, string> = {}
    for (const header of ['content-type', 'idempotency-key']) {
      const value = request.headers.get(header)
      if (value) headers[header] = value
    }
    const text = request.method === 'GET' ? '' : await request.text()
    calls.push({
      name,
      method: request.method,
      path: url.pathname.replace(UID, '{{uid}}'),
      query: [...url.searchParams.entries()],
      headers,
      ...(text ? { body: JSON.parse(text) } : {})
    })
    return Response.json({}, { status: 503 })
  })
  await run()
  if (calls.length !== 1)
    throw new Error(`${name}: expected 1 backend request, saw ${calls.length}`)
  return withPlaceholders(calls[0]) as Captured
}

describe('website catalog requests (contract fixture)', () => {
  it('records the real outgoing requests for the Cloud contract test', async () => {
    vi.stubEnv('SITE_CATALOG_API_URL', ORIGIN)
    vi.stubEnv('VERCEL_ENV', 'preview')
    const state = session.state
    const requests = [
      await capture('create item', () =>
        contentAPI(
          routeContext(
            'content-api',
            'save',
            savePayload(document, 'workflow', DRAFT_REV)
          )
        )
      ),
      await capture('replace item', () =>
        contentAPI(
          routeContext('content-api', 'save', {
            ...savePayload(
              { ...document, description: 'Edited by the contract test' },
              'workflow',
              DRAFT_REV,
              {
                uid: UID,
                revision_uid: REVISION_UID,
                schema_version: 2
              } as Parameters<typeof savePayload>[3]
            ),
            uid: UID
          })
        )
      ),
      await capture('final review', () =>
        catalogAPI(
          routeContext(
            'catalog-api',
            'final-review',
            checkedReviewPayload(
              { state } as Parameters<typeof checkedReviewPayload>[0],
              [UID]
            )
          )
        )
      ),
      await capture('publish', () =>
        catalogAPI(
          routeContext(
            'catalog-api',
            'publish',
            publicationPayload(
              { state, selection_digest: DIGEST } as Parameters<
                typeof publicationPayload
              >[0],
              [UID]
            )
          )
        )
      ),
      await capture('cards list', () =>
        loadSiteCatalogList(undefined, 'en', 'workflows')
      ),
      await capture('item detail', () =>
        loadSiteCatalog(undefined, 'en', `/hub/workflows/${SLUG}`)
      )
    ]
    await expect(
      `${JSON.stringify({ requests }, null, 2)}\n`
    ).toMatchFileSnapshot('./website-catalog-requests.json')
  })
})
