import type { Dirent } from 'node:fs'
import { lstat, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const forbidden = new Set([
  '_worker.js',
  'functions',
  '_headers',
  '_redirects',
  '_routes.json',
  'wrangler.toml',
  'wrangler.json',
  'wrangler.jsonc'
])

function forbiddenEntry(entry: Dirent): boolean {
  return entry.isSymbolicLink() || forbidden.has(entry.name.toLowerCase())
}

async function requireIframe(root: string): Promise<void> {
  const iframe = await lstat(join(root, 'iframe.html')).catch(() => undefined)
  if (!iframe?.isFile()) throw new Error('Missing catalog iframe')
}

function matchesSource(metadata: unknown, sha: string): boolean {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'commit' in metadata &&
    metadata.commit === sha
  )
}

async function validateTree(root: string): Promise<void> {
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (forbiddenEntry(entry)) {
      throw new Error(`Forbidden preview entry: ${entry.name}`)
    }
    if (entry.isDirectory()) await validateTree(join(root, entry.name))
  }
}

export async function validateMarketingPreview(
  root: string,
  sha: string
): Promise<void> {
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error('Invalid source commit')
  if (!(await lstat(root)).isDirectory())
    throw new Error('Invalid preview directory')
  await validateTree(root)
  await requireIframe(root)
  const metadata: unknown = JSON.parse(
    await readFile(join(root, 'build-info.json'), 'utf8')
  )
  if (!matchesSource(metadata, sha)) {
    throw new Error('Preview source commit mismatch')
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await validateMarketingPreview(process.argv[2], process.argv[3])
}
