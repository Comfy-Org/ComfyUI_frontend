import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

import {
  ROUTER_COMFY_ONLY_PREVIEW,
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_SERVING_PROVIDERS
} from '../src/config/router-providers'

const DOCS_ORIGIN = 'https://docs.comfy.org'
const ROUTER_DOCS = `${DOCS_ORIGIN}/development/comfy-router`
const PROVIDERS_PAGE = `${ROUTER_DOCS}/providers.md`
const MODELS_PAGE = `${ROUTER_DOCS}/models.md`
const ROUTER_SCHEMAS =
  'https://raw.githubusercontent.com/Comfy-Org/docs/main/router-schemas'

interface FetchTextOptions {
  attempts?: number
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
  timeoutMs?: number
}

interface DocsCoverageRow {
  name: string
  docsUrl: string
  comfy: string
}

export async function fetchText(
  url: string,
  {
    attempts = 3,
    fetchImpl = fetch,
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    timeoutMs = 4_000
  }: FetchTextOptions = {}
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(timeoutMs)
      })
      if (!response.ok) throw new Error(`${url} responded ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
      if (attempt + 1 < attempts) await sleep(250 * 2 ** attempt)
    }
  }
  throw new Error(`Could not fetch ${url}`, { cause: lastError })
}

export function alternateProviders(spec: string): string[] {
  const parsed: unknown = JSON.parse(spec)
  assert.ok(parsed && typeof parsed === 'object')
  const providers = Reflect.get(parsed, 'x-comfy-router-alt-providers')
  assert.ok(Array.isArray(providers))
  return providers.map((entry: unknown) => {
    assert.ok(entry && typeof entry === 'object')
    const provider = Reflect.get(entry, 'provider')
    assert.equal(typeof provider, 'string')
    return provider
  })
}

export function parseCoverageTable(markdown: string): {
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
  assert.ok(header, 'Provider coverage table is missing')
  const columns = cells(header).map((column) => column.replaceAll('**', ''))
  assert.deepEqual(columns.slice(0, 2), ['Model / provider', 'Comfy (default)'])
  return {
    providers: columns.slice(2),
    rows: body.map((line) => {
      const [model, comfy] = cells(line)
      const link = /^\[(.+)\]\((.+)\)$/.exec(model)
      assert.ok(link, `Unexpected model cell: ${model}`)
      return { name: link[1], docsUrl: `${DOCS_ORIGIN}${link[2]}`, comfy }
    })
  }
}

export async function checkRouterProviderDrift(): Promise<void> {
  const [coverageMarkdown, catalogMarkdown, ...specs] = await Promise.all([
    fetchText(PROVIDERS_PAGE),
    fetchText(MODELS_PAGE),
    ...ROUTER_PROVIDER_COVERAGE.map((row) =>
      fetchText(`${ROUTER_SCHEMAS}/${row.modelId}.json`)
    )
  ])
  assert.deepEqual(
    specs.map((spec) => alternateProviders(spec).sort()),
    ROUTER_PROVIDER_COVERAGE.map((row) => [...row.providers].sort())
  )

  const docs = parseCoverageTable(coverageMarkdown)
  assert.deepEqual(
    docs.providers,
    ROUTER_SERVING_PROVIDERS.map((provider) => provider.name)
  )
  assert.ok(docs.rows.every((row) => row.comfy === '✓'))
  const byDocsUrl = (a: { docsUrl: string }, b: { docsUrl: string }) =>
    a.docsUrl.localeCompare(b.docsUrl)
  assert.deepEqual(
    docs.rows.map(({ docsUrl, name }) => ({ docsUrl, name })).sort(byDocsUrl),
    ROUTER_PROVIDER_COVERAGE.map((row) => ({
      docsUrl: row.docsUrl,
      name: row.docsName ?? row.name
    })).sort(byDocsUrl)
  )

  const missingCatalogLinks = ROUTER_COMFY_ONLY_PREVIEW.filter(
    ({ name, docsUrl }) =>
      !catalogMarkdown.includes(
        `[${name}](${docsUrl.slice(DOCS_ORIGIN.length)})`
      )
  ).map(({ name }) => name)
  const previewPathsInCoverage = ROUTER_COMFY_ONLY_PREVIEW.map(({ docsUrl }) =>
    docsUrl.slice(DOCS_ORIGIN.length)
  ).filter((path) => coverageMarkdown.includes(path))
  assert.deepEqual(missingCatalogLinks, [])
  assert.deepEqual(previewPathsInCoverage, [])
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  checkRouterProviderDrift()
    .then(() => {
      console.log('Router provider coverage matches the published sources.')
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
}
