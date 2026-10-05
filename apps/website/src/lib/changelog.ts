const CHANGELOG_SOURCE =
  'https://raw.githubusercontent.com/Comfy-Org/docs/main/changelog/index.mdx'
export const CHANGELOG_DOCS = 'https://docs.comfy.org/changelog/index'
export const CHANGELOG_CACHE_KEY = 'comfy-docs-changelog-v1'
export const CHANGELOG_REFRESH_MS = 5 * 60 * 1000
export const CHANGELOG_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

export interface ChangelogEntry {
  label: string
  date: string
  markdown: string
}

// Mintlify wrappers are data, never executable MDX. Fail closed on format drift
// rather than silently presenting a partial changelog as current.
export function parseChangelog(source: string): ChangelogEntry[] {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, '')
  const entries: ChangelogEntry[] = []
  const pattern =
    /<Update\s+label="([^"]+)"\s+description="([^"]+)"\s*>([\s\S]*?)<\/Update>/g
  for (const match of body.matchAll(pattern)) {
    const [, label, date, markdown] = match
    if (!label || !date || !markdown.trim()) throw new Error('Empty update')
    entries.push({ label, date, markdown: markdown.trim() })
  }
  if (!entries.length || body.replace(pattern, '').trim()) {
    throw new Error('Unsupported changelog format')
  }
  return entries
}

export function readChangelogCache(storage: Pick<Storage, 'getItem'>) {
  try {
    const raw: unknown = JSON.parse(
      storage.getItem(CHANGELOG_CACHE_KEY) ?? 'null'
    )
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('source' in raw) ||
      typeof raw.source !== 'string' ||
      !('checkedAt' in raw) ||
      typeof raw.checkedAt !== 'number' ||
      !Number.isFinite(raw.checkedAt) ||
      raw.checkedAt > Date.now() ||
      Date.now() - raw.checkedAt > CHANGELOG_CACHE_MAX_AGE_MS
    )
      return undefined
    return { entries: parseChangelog(raw.source), checkedAt: raw.checkedAt }
  } catch {
    return undefined
  }
}

export async function fetchChangelog() {
  const response = await fetch(CHANGELOG_SOURCE, {
    cache: 'no-cache',
    signal: AbortSignal.timeout(10000)
  })
  if (!response.ok)
    throw new Error(`Changelog request failed: ${response.status}`)
  const source = await response.text()
  return { source, entries: parseChangelog(source), checkedAt: Date.now() }
}
