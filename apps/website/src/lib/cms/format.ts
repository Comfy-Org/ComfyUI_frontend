import type { Locale } from '@/i18n/translations'
import type { QueueChange } from './queue'

export function formatUtc(value: string, locale: Locale) {
  return `${new Date(value).toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  })} UTC`
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/

export function formatValue(value: unknown, locale: Locale = 'en'): string {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value === 'string' && ISO_DATE.test(value))
    return formatUtc(value, locale)
  if (Array.isArray(value))
    return value.map((entry) => formatValue(entry, locale)).join(', ')
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const MEDIA_LINK =
  /^(data:(image|video)\/|https?:\/\/\S+\.(png|jpe?g|webp|gif|avif|mp4|webm|mov)(\?|$))/i

/** The image or video link a field holds, so a review can show it. */
export function mediaOf(value: unknown): string | undefined {
  const link =
    value && typeof value === 'object' && 'url' in value ? value.url : value
  return typeof link === 'string' && MEDIA_LINK.test(link) ? link : undefined
}

export function humanizeField(field: string) {
  const words = field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export const LISTING_KINDS = ['MODEL', 'WORKFLOW', 'APP'] as const
export type ListingFilter = (typeof LISTING_KINDS)[number] | 'ALL'

export function matchesListing(
  filter: ListingFilter,
  query: string,
  kind: string,
  searchable: (string | undefined)[]
) {
  const needle = query.trim().toLowerCase()
  const kindMatches = filter === 'ALL' || kind === filter
  return (
    kindMatches &&
    (!needle || searchable.join(' ').toLowerCase().includes(needle))
  )
}

export function kindCounts(kinds: string[]): Record<ListingFilter, number> {
  const count = (kind: string) => kinds.filter((each) => each === kind).length
  return {
    ALL: kinds.length,
    MODEL: count('MODEL'),
    WORKFLOW: count('WORKFLOW'),
    APP: count('APP')
  }
}

export const isFuture = (value: string | undefined, now = Date.now()) =>
  value !== undefined && Date.parse(value) > now

export interface DraftPageChange {
  id: string
  title: string
  change: QueueChange
  slug: string
  visibleFrom?: string
}

export interface PreviewChange {
  id: string
  title: string
  change: QueueChange
  page: string
  detail: string
  launch?: string
}

export const pageOf = (slug: string) => slug.replace(/\/?$/, '/')

export function previewChanges(
  changes: DraftPageChange[],
  clock: number,
  describeLaunch: (at: string) => string
): PreviewChange[] {
  return changes.map((change) => {
    const launch = isFuture(change.visibleFrom, clock)
      ? change.visibleFrom
      : undefined
    return {
      id: change.id,
      title: change.title,
      change: change.change,
      page: pageOf(change.slug),
      detail: launch ? describeLaunch(launch) : change.slug,
      launch
    }
  })
}
