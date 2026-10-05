import { createHash } from 'node:crypto'

import {
  INDEXNOW_KEY,
  INDEXNOW_KEY_LOCATION,
  INDEXNOW_MAX_URLS_PER_REQUEST,
  INDEXNOW_SITE
} from '@/config/indexnow'
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

/**
 * Fingerprints the page's markdown twin (title, description, canonical and
 * `<main>`), so header, footer and hashed asset names never count as a change.
 * A noindex page has no fingerprint: it must never be submitted.
 */
export function pageFingerprint(html: string, url: string): string | null {
  if (isNoindex(html)) return null
  const twin = renderTwin(htmlToTwin(html, url))
  return createHash('sha256').update(twin).digest('hex')
}

function isManifest(value: unknown): value is IndexNowManifest {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((hash) => typeof hash === 'string')
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
  return manifest
    ? { kind: 'found', manifest }
    : { kind: 'unavailable', reason: 'live manifest is not a valid manifest' }
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
  if (!current)
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
