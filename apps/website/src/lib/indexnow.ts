import { escapeRegExp } from 'es-toolkit'
import { createHash } from 'node:crypto'

import {
  INDEXNOW_ENDPOINT,
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_MAX_URLS_PER_REQUEST,
  INDEXNOW_SITE
} from '@/config/indexnow'
import { LOCALE_CODES } from '@/config/locales'
import { translationsFor } from '@/i18n/translations'
import { htmlToTwin, renderTwin } from '@/lib/markdown-twin'

/** Sitemap URL → sha256 of the page's crawler-visible content. */
export type IndexNowManifest = Record<string, string>

export interface IndexNowPayload {
  host: string
  key: string
  keyLocation: string
  urlList: string[]
}

interface ManifestDiff {
  added: string[]
  changed: string[]
  removed: string[]
}

type PreviousManifest =
  | { kind: 'found'; manifest: IndexNowManifest }
  | { kind: 'first-run' }
  | { kind: 'unavailable'; reason: string }

const META_TAG = /<meta\b[^>]*>/gi

function isNoindex(html: string): boolean {
  return [...html.matchAll(META_TAG)].some(
    ([tag]) => /name="robots"/i.test(tag) && /noindex/i.test(tag)
  )
}

function isOnSite(url: string): boolean {
  return url.startsWith(`${INDEXNOW_SITE}/`)
}

const LIVE_PACK_STAT_LABELS = new Set(
  LOCALE_CODES.flatMap((locale) => {
    const { t } = translationsFor(locale)
    return [t('cloudNodes.detail.downloads'), t('cloudNodes.detail.stars')]
  })
)

const LIVE_PACK_STAT = new RegExp(
  `(\\*\\*(?:${[...LIVE_PACK_STAT_LABELS].map(escapeRegExp).join('|')})\\*\\*\\n\\n)[^\\n]*`,
  'g'
)

/** Custom-node download and star counts are fetched live on every build. */
function withoutLiveStats(twin: string, url: string): string {
  return new URL(url).pathname.includes('/cloud/supported-nodes/')
    ? twin.replace(LIVE_PACK_STAT, '$1')
    : twin
}

const PACK_INDEX_PATH = /\/cloud\/supported-nodes\/$/

/**
 * The pack index lists packs by live download rank, so a rank swap would read
 * as a change. Each `### ` pack section is put in name order instead.
 */
function packsInNameOrder(twin: string): string {
  const runs: string[][] = []
  for (const block of twin.split(/\n(?=#{1,3} )/).map((b) => b.trimEnd())) {
    const run = runs.at(-1)
    if (block.startsWith('### ') && run?.[0].startsWith('### ')) run.push(block)
    else runs.push([block])
  }
  return runs.flatMap((run) => run.toSorted()).join('\n')
}

function fingerprintInput(twin: string, url: string): string {
  const stable = withoutLiveStats(twin, url)
  return PACK_INDEX_PATH.test(new URL(url).pathname)
    ? packsInNameOrder(stable)
    : stable
}

/**
 * Fingerprints the page's markdown twin (title, description, canonical and
 * `<main>`), so header, footer and hashed asset names never count as a change.
 * A noindex page has no fingerprint: it must never be submitted.
 */
export function pageFingerprint(html: string, url: string): string | null {
  if (isNoindex(html)) return null
  const twin = fingerprintInput(renderTwin(htmlToTwin(html, url)), url)
  return createHash('sha256').update(twin).digest('hex')
}

function isManifest(value: unknown): value is IndexNowManifest {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.entries(value).every(
      ([url, hash]) => isOnSite(url) && typeof hash === 'string'
    )
  )
}

function parseManifest(body: string): IndexNowManifest | undefined {
  try {
    const parsed: unknown = JSON.parse(body)
    return isManifest(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/**
 * A 404 means no manifest was ever deployed, so every URL is new. Any other
 * failure skips the run rather than resubmitting the whole site.
 */
function parsePreviousManifest(status: number, body: string): PreviousManifest {
  if (status === 404) return { kind: 'first-run' }
  if (status !== 200)
    return { kind: 'unavailable', reason: `live manifest returned ${status}` }
  const manifest = parseManifest(body)
  if (!manifest)
    return {
      kind: 'unavailable',
      reason: 'live manifest is not a valid manifest'
    }
  return Object.keys(manifest).length === 0
    ? { kind: 'unavailable', reason: 'live manifest is empty' }
    : { kind: 'found', manifest }
}

export function diffManifests(
  previous: IndexNowManifest,
  current: IndexNowManifest
): ManifestDiff {
  const currentUrls = Object.keys(current).filter(isOnSite)
  return {
    added: currentUrls.filter((url) => !(url in previous)),
    changed: currentUrls.filter(
      (url) => url in previous && previous[url] !== current[url]
    ),
    removed: Object.keys(previous)
      .filter(isOnSite)
      .filter((url) => !(url in current))
  }
}

export function indexNowPayloads(
  urls: readonly string[],
  batchSize = INDEXNOW_MAX_URLS_PER_REQUEST
): IndexNowPayload[] {
  const host = new URL(INDEXNOW_SITE).host
  const payloads: IndexNowPayload[] = []
  for (let start = 0; start < urls.length; start += batchSize) {
    payloads.push({
      host,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: urls.slice(start, start + batchSize)
    })
  }
  return payloads
}

type SubmissionPlan =
  | { kind: 'skip'; reason: string }
  | { kind: 'submit'; summary: string; payloads: IndexNowPayload[] }

export function planSubmission(
  currentBody: string,
  previousStatus: number,
  previousBody: string
): SubmissionPlan {
  const current = parseManifest(currentBody)
  if (!current || Object.keys(current).length === 0)
    return { kind: 'skip', reason: 'the build has no valid manifest' }
  const previous = parsePreviousManifest(previousStatus, previousBody)
  if (previous.kind === 'unavailable')
    return { kind: 'skip', reason: previous.reason }
  const { added, changed, removed } = diffManifests(
    previous.kind === 'found' ? previous.manifest : {},
    current
  )
  const firstRun = previous.kind === 'first-run' ? ' (first run)' : ''
  return {
    kind: 'submit',
    summary: `IndexNow: ${added.length} added, ${changed.length} changed, ${removed.length} removed${firstRun}`,
    payloads: indexNowPayloads([...added, ...changed, ...removed])
  }
}

const REQUEST_TIMEOUT_MS = 30_000
const ACCEPTED = new Set([200, 202])
const REJECTION_EXCERPT_CHARS = 200

export interface SendNote {
  level: 'info' | 'warn'
  line: string
}

interface Sender {
  fetch: typeof fetch
  log: (note: SendNote) => void
}

async function keyFileIsLive(fetchFn: typeof fetch): Promise<boolean> {
  const response = await fetchFn(INDEXNOW_KEY_LOCATION, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  const body = await response.text()
  return response.ok && body.trim() === INDEXNOW_KEY
}

async function postBatch(
  fetchFn: typeof fetch,
  payload: IndexNowPayload,
  label: string
): Promise<SendNote> {
  const response = await fetchFn(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  })
  const line = `${label} (${payload.urlList.length} URLs): HTTP ${response.status}`
  if (ACCEPTED.has(response.status)) {
    await response.body?.cancel()
    return { level: 'info', line: `IndexNow ${line}` }
  }
  const reason = (await response.text())
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, REJECTION_EXCERPT_CHARS)
  return {
    level: 'warn',
    line: `IndexNow rejected: ${line}${reason ? `: ${reason}` : ''}`
  }
}

/** Posts batches in order and stops at the first one IndexNow refuses. */
export async function sendPayloads(
  payloads: readonly IndexNowPayload[],
  { fetch: fetchFn, log }: Sender
): Promise<void> {
  if (payloads.length === 0) return
  if (!(await keyFileIsLive(fetchFn))) {
    log({
      level: 'warn',
      line: `IndexNow skipped: key file ${INDEXNOW_KEY_LOCATION} does not serve the key`
    })
    return
  }
  for (const [index, payload] of payloads.entries()) {
    const note = await postBatch(
      fetchFn,
      payload,
      `batch ${index + 1}/${payloads.length}`
    )
    log(note)
    if (note.level === 'warn') return
  }
}
