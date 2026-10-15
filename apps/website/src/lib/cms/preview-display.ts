import type { Locale } from '@/i18n/translations'

// Display data only. Eligibility, sessions and preview cookies belong to the
// authenticated route adapter; nothing in this module grants access.
export interface CatalogPreviewChange {
  uid: string
  title: string
  kind: 'added' | 'modified' | 'deleted'
  summary: string
  fields?: string[]
  route?: string
  visibleFrom?: string
  pagePath?: string
}
export interface CatalogScheduledPage {
  uid: string
  title: string
  at: string
}
export function safeInternalPath(path: string | undefined): string | undefined {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return
  try {
    const decoded = decodeURIComponent(path)
    if (decoded.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(decoded))
      return
    const url = new URL(path, 'https://comfy.org')
    if (url.origin !== 'https://comfy.org') return
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return
  }
}
export function utcInput(at: string | undefined): string {
  if (!at) return ''
  const date = new Date(at)
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 16) : ''
}
export function parseUtcInput(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return
  const date = new Date(`${value}:00.000Z`)
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 16) !== value
  )
    return
  return date.toISOString()
}
export function formatPreviewUtc(at: string, locale: Locale): string {
  const date = new Date(at)
  if (!Number.isFinite(date.getTime())) return ''
  return `${new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
    hour12: false
  }).format(date)} UTC`
}
