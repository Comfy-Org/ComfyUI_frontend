import { combineAbortSignals, createTimeoutSignal } from '@/utils/abortSignal'

export const CHANGELOG_SOURCE =
  'https://raw.githubusercontent.com/Comfy-Org/docs/main/changelog/index.mdx'
export const CHANGELOG_DOCS = 'https://docs.comfy.org/changelog'
export const CHANGELOG_CACHE_KEY = 'comfy-docs-changelog-v1'
export const CHANGELOG_REFRESH_MS = 5 * 60 * 1000
const CHANGELOG_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
const CHANGELOG_TIMEOUT_MS = 10 * 1000

export interface ChangelogEntry {
  id: string
  label: string
  date: string
  markdown: string
}

function releaseId(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

const UPDATE_ATTRIBUTES = new Set(['description', 'label', 'rss', 'tags'])

const attributesPattern =
  /\s+(?<name>\w+)\s*=\s*("(?<double>[^"]*)"|'(?<single>[^']*)'|\{(?:[^{}]|\{[^{}]*\})*\})/g
const updatePattern = new RegExp(
  `<Update(?<attributes>(?:${attributesPattern.source})*)\\s*>(?<markdown>[\\s\\S]*?)<\\/Update>`,
  'g'
)

function updateMetadata(attributes: string) {
  const values = new Map<string, string | undefined>()
  for (const match of attributes.matchAll(attributesPattern)) {
    const [, name] = match
    if (!UPDATE_ATTRIBUTES.has(name) || values.has(name))
      throw new Error('Unsupported update metadata')
    values.set(name, match.groups?.double ?? match.groups?.single)
  }
  return { label: values.get('label'), date: values.get('description') }
}

export function parseChangelog(source: string): ChangelogEntry[] {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---\s*/, '')
  const entries: ChangelogEntry[] = []
  const releaseIds = new Set<string>()
  for (const match of body.matchAll(updatePattern)) {
    if (!match.groups) throw new Error('Unsupported update')
    const { attributes, markdown } = match.groups
    const { label, date } = updateMetadata(attributes)
    if (!label || !date || !markdown.trim()) throw new Error('Empty update')
    const id = releaseId(label)
    if (releaseIds.has(id)) throw new Error('Ambiguous release label')
    releaseIds.add(id)
    entries.push({ id, label, date, markdown: markdown.trim() })
  }
  if (!entries.length || body.replace(updatePattern, '').trim()) {
    throw new Error('Unsupported changelog format')
  }
  return entries
}

export function readChangelogCache(storage?: Pick<Storage, 'getItem'>) {
  try {
    const raw: unknown = JSON.parse(
      (storage ?? localStorage).getItem(CHANGELOG_CACHE_KEY) ?? 'null'
    )
    if (
      !raw ||
      typeof raw !== 'object' ||
      !('source' in raw) ||
      typeof raw.source !== 'string' ||
      !('checkedAt' in raw) ||
      typeof raw.checkedAt !== 'number' ||
      raw.checkedAt > Date.now() ||
      Date.now() - raw.checkedAt > CHANGELOG_CACHE_MAX_AGE_MS
    )
      return undefined
    return parseChangelog(raw.source)
  } catch {
    return undefined
  }
}

export function writeChangelogCache(
  source: string,
  storage?: Pick<Storage, 'setItem'>
) {
  try {
    const target = storage ?? localStorage
    target.setItem(
      CHANGELOG_CACHE_KEY,
      JSON.stringify({ source, checkedAt: Date.now() })
    )
    return true
  } catch {
    return false
  }
}

export async function fetchChangelog(signal?: AbortSignal) {
  const timeout = createTimeoutSignal(CHANGELOG_TIMEOUT_MS)
  const response = await fetch(CHANGELOG_SOURCE, {
    cache: 'no-cache',
    signal: signal ? combineAbortSignals([signal, timeout]) : timeout
  })
  if (!response.ok)
    throw new Error(`Changelog request failed: ${response.status}`)
  const source = await response.text()
  return { source, entries: parseChangelog(source) }
}
