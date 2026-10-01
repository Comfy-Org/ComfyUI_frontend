// @vitest-environment node

import { z } from 'astro/zod'
import { describe, expect, it, vi } from 'vitest'

import {
  ROUTER_COMFY_ONLY_PREVIEW,
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_PROVIDER_COVERAGE_VERIFIED_AT,
  ROUTER_SERVING_PROVIDERS
} from './router-providers'

const DOCS_ORIGIN = 'https://docs.comfy.org'
const ROUTER_DOCS = `${DOCS_ORIGIN}/development/comfy-router`
const PROVIDERS_PAGE = `${ROUTER_DOCS}/providers.md`
const MODELS_PAGE = `${ROUTER_DOCS}/models.md`
// The per-model API spec, as the backend publishes it for the docs site.
const ROUTER_SCHEMAS =
  'https://raw.githubusercontent.com/Comfy-Org/docs/main/router-schemas'

// The API spec and the docs are the source of truth and live outside this
// repository, so the drift checks reach the network. They run in CI and skip
// elsewhere. CI treats an unavailable source as a failure so missing coverage
// cannot produce a green build.
const skipReason = process.env.CI
  ? null
  : 'checks the published API spec; runs in CI only (set CI=1 to run it here)'

async function fetchDocs(url: string): Promise<string | null> {
  let response: Response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  } catch (error) {
    if (process.env.CI)
      throw new Error(`Could not fetch ${url}`, { cause: error })
    return null
  }
  if (!response.ok) throw new Error(`${url} responded ${response.status}`)
  return response.text()
}

interface DocsCoverageRow {
  name: string
  docsUrl: string
  comfy: string
  providers: string[]
}

/** Reads the "Provider coverage" table from the docs page's Markdown. */
function parseCoverageTable(markdown: string): {
  providers: string[]
  rows: DocsCoverageRow[]
} {
  const section = markdown.slice(markdown.indexOf('## Provider coverage'))
  const lines = section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'))
  const cells = (line: string) =>
    line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim())
  const [header, , ...body] = lines
  const columns = cells(header).map((column) => column.replaceAll('**', ''))
  expect(columns.slice(0, 2)).toEqual(['Model / provider', 'Comfy (default)'])
  const providers = columns.slice(2)
  const rows = body.map((line) => {
    const [model, comfy, ...routes] = cells(line)
    const link = /^\[(.+)\]\((.+)\)$/.exec(model)
    if (!link) throw new Error(`Unexpected model cell: ${model}`)
    return {
      name: link[1],
      docsUrl: `${DOCS_ORIGIN}${link[2]}`,
      comfy,
      providers: providers.filter((_, index) => routes[index] !== '-')
    }
  })
  return { providers, rows }
}

describe('Router provider source availability', () => {
  it('skips an unavailable source outside CI', async () => {
    vi.stubEnv('CI', '')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(fetchDocs(PROVIDERS_PAGE)).resolves.toBeNull()
  })

  it('fails when a required source is unavailable in CI', async () => {
    vi.stubEnv('CI', '1')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    await expect(fetchDocs(PROVIDERS_PAGE)).rejects.toThrow(
      `Could not fetch ${PROVIDERS_PAGE}`
    )
  })
})

describe('Router provider coverage', () => {
  it('lists each model once, alphabetically', () => {
    const names = ROUTER_PROVIDER_COVERAGE.map((row) => row.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(new Set(names).size).toBe(names.length)
    expect(ROUTER_PROVIDER_COVERAGE_VERIFIED_AT).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("matches each model's alternate providers in the API spec", async (ctx) => {
    if (skipReason) return ctx.skip(skipReason)
    const specs = await Promise.all(
      ROUTER_PROVIDER_COVERAGE.map((row) =>
        fetchDocs(`${ROUTER_SCHEMAS}/${row.modelId}.json`)
      )
    )
    if (specs.includes(null)) return ctx.skip('could not fetch the API spec')

    const altProviders = z.object({
      'x-comfy-router-alt-providers': z
        .array(z.object({ provider: z.string() }))
        .default([])
    })
    expect(
      specs.map((spec) =>
        altProviders
          .parse(JSON.parse(spec ?? '{}'))
          ['x-comfy-router-alt-providers'].map(({ provider }) => provider)
          .sort()
      )
    ).toEqual(ROUTER_PROVIDER_COVERAGE.map((row) => [...row.providers].sort()))
  })

  it('lists every model the docs show with an alternate provider', async (ctx) => {
    if (skipReason) return ctx.skip(skipReason)
    const markdown = await fetchDocs(PROVIDERS_PAGE)
    if (markdown === null) return ctx.skip(`could not fetch ${PROVIDERS_PAGE}`)

    const docs = parseCoverageTable(markdown)
    expect(docs.providers).toEqual(
      ROUTER_SERVING_PROVIDERS.map((provider) => provider.name)
    )
    expect(docs.rows.every((row) => row.comfy === '✓')).toBe(true)
    const byDocsUrl = (a: { docsUrl: string }, b: { docsUrl: string }) =>
      a.docsUrl.localeCompare(b.docsUrl)
    expect(
      docs.rows
        .map((row) => ({ docsUrl: row.docsUrl, name: row.name }))
        .sort(byDocsUrl)
    ).toEqual(
      ROUTER_PROVIDER_COVERAGE.map((row) => ({
        docsUrl: row.docsUrl,
        name: row.docsName ?? row.name
      })).sort(byDocsUrl)
    )
  })

  it('previews catalog models that only Comfy serves', async (ctx) => {
    if (skipReason) return ctx.skip(skipReason)
    const [catalog, coverage] = await Promise.all([
      fetchDocs(MODELS_PAGE),
      fetchDocs(PROVIDERS_PAGE)
    ])
    if (catalog === null || coverage === null)
      return ctx.skip('could not fetch the docs catalog')

    for (const { name, docsUrl } of ROUTER_COMFY_ONLY_PREVIEW) {
      const path = docsUrl.slice(DOCS_ORIGIN.length)
      expect(catalog).toContain(`[${name}](${path})`)
      expect(coverage).not.toContain(path)
    }
  })
})
