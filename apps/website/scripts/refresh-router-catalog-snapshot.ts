import { renameSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { z } from 'zod'

import {
  DOCS_REPO,
  buildRouterCatalogSnapshot
} from '../src/config/router-catalog-snapshot'

const snapshotPath = fileURLToPath(
  new URL('../src/data/router-catalog.snapshot.json', import.meta.url)
)
const tempPath = `${snapshotPath}.tmp`
const docsCommit = z.string().regex(/^[0-9a-f]{40}$/)

const args = process.argv.slice(2).filter((arg) => arg !== '--')
const requested = args[0]
if (args.length > 1) {
  process.stderr.write(
    'Usage: refresh-router-catalog-snapshot.ts [docs-commit]\n'
  )
  process.exit(1)
}

const headers = new Headers({
  'User-Agent': 'comfy-router-catalog-snapshot'
})
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
if (token) headers.set('Authorization', `Bearer ${token}`)

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(20_000)
  })
  if (!response.ok) throw new Error(`${url} responded ${response.status}`)
  return response.text()
}

async function resolveDocsMainSha(): Promise<string> {
  const response = await fetch(
    `https://api.github.com/repos/${DOCS_REPO}/commits/main`,
    {
      headers: new Headers({
        ...Object.fromEntries(headers),
        Accept: 'application/vnd.github+json'
      }),
      signal: AbortSignal.timeout(20_000)
    }
  )
  if (!response.ok) {
    throw new Error(`Could not resolve ${DOCS_REPO} main (${response.status})`)
  }
  const body: unknown = await response.json()
  return z.object({ sha: docsCommit }).parse(body).sha
}

const sourceCommit = requested
  ? docsCommit.parse(requested)
  : await resolveDocsMainSha()
const raw = `https://raw.githubusercontent.com/${DOCS_REPO}/${sourceCommit}`
const [modelsMarkdown, providersMarkdown] = await Promise.all([
  fetchText(`${raw}/development/comfy-router/models.mdx`),
  fetchText(`${raw}/development/comfy-router/providers.mdx`)
])

const snapshot = await buildRouterCatalogSnapshot({
  sourceCommit,
  modelsMarkdown,
  providersMarkdown,
  readSchema: async (modelId) => {
    const text = await fetchText(`${raw}/router-schemas/${modelId}.json`)
    const parsed: unknown = JSON.parse(text)
    return parsed
  }
})

writeFileSync(tempPath, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
renameSync(tempPath, snapshotPath)
process.stdout.write(
  `Wrote ${snapshot.models.length} model(s) from ${sourceCommit} to ${snapshotPath}\n`
)
