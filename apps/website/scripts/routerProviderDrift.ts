import assert from 'node:assert/strict'

import { z } from 'zod'

import {
  ROUTER_COMFY_ONLY_PREVIEW,
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_SERVING_PROVIDERS
} from '../src/config/router-providers'
import { isDirectExecution } from './script-entry-point'

const DOCS_ORIGIN = 'https://docs.comfy.org'
const ROUTER_DOCS = `${DOCS_ORIGIN}/development/comfy-router`
const PROVIDERS_PAGE = `${ROUTER_DOCS}/providers.md`
const MODELS_PAGE = `${ROUTER_DOCS}/models.md`
const ROUTER_SCHEMAS =
  'https://raw.githubusercontent.com/Comfy-Org/docs/main/router-schemas'

interface FetchTextOptions {
  fetchImpl?: typeof fetch
  sleep?: (milliseconds: number) => Promise<void>
}

const FETCH_ATTEMPTS = 3
const FETCH_TIMEOUT_MS = 4_000
const alternateProvidersSchema = z
  .object({
    'x-comfy-router-alt-providers': z
      .array(z.object({ provider: z.string() }))
      .default([])
  })
  .transform((schema) =>
    schema['x-comfy-router-alt-providers'].map(({ provider }) => provider)
  )

interface DocsCoverageRow {
  name: string
  docsUrl: string
  comfy: string
}

export async function fetchText(
  url: string,
  {
    fetchImpl = fetch,
    sleep = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds))
  }: FetchTextOptions = {}
): Promise<string> {
  let lastError: unknown
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
      })
      if (!response.ok) throw new Error(`${url} responded ${response.status}`)
      return await response.text()
    } catch (error) {
      lastError = error
      if (attempt + 1 < FETCH_ATTEMPTS) await sleep(250 * 2 ** attempt)
    }
  }
  throw new Error(`Could not fetch ${url}`, { cause: lastError })
}

export function alternateProviders(spec: string): string[] {
  return alternateProvidersSchema.parse(JSON.parse(spec))
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

export async function checkRouterProviderDrift(
  options: FetchTextOptions = {}
): Promise<void> {
  const [coverageMarkdown, catalogMarkdown, ...specs] = await Promise.all([
    fetchText(PROVIDERS_PAGE, options),
    fetchText(MODELS_PAGE, options),
    ...ROUTER_PROVIDER_COVERAGE.map((row) =>
      fetchText(`${ROUTER_SCHEMAS}/${row.modelId}.json`, options)
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

if (isDirectExecution(process.argv[1], import.meta.filename)) {
  checkRouterProviderDrift()
    .then(() => {
      console.warn('Router provider coverage matches the published sources.')
    })
    .catch((error: unknown) => {
      console.error(error)
      process.exitCode = 1
    })
}
