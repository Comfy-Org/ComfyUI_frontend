const ATTRIBUTION_STORAGE_KEY = 'comfy_website_attribution'

const CLICK_ID_QUERY_KEYS = [
  'im_ref',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ttclid',
  'li_fat_id'
] as const
const CLICK_ID_QUERY_KEY_SET = new Set<string>(CLICK_ID_QUERY_KEYS)

const ATTRIBUTION_HOSTNAMES = new Set([
  'comfy.org',
  'www.comfy.org',
  'cloud.comfy.org',
  'platform.comfy.org'
])

type AttributionParams = Record<string, string>
let attributionPersistenceInitialized = false

function isAttributionQueryKey(key: string): boolean {
  return key.startsWith('utm_') || CLICK_ID_QUERY_KEY_SET.has(key)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasAttribution(params: AttributionParams): boolean {
  return Object.keys(params).length > 0
}

export function readAttributionFromSearch(search: string): AttributionParams {
  const params = new URLSearchParams(search)
  const attribution: AttributionParams = {}

  for (const [key, value] of params) {
    if (value && isAttributionQueryKey(key)) {
      attribution[key] = value
    }
  }

  return attribution
}

function readStoredAttribution(storage: Storage): AttributionParams {
  try {
    const stored = storage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!stored) return {}

    const parsed: unknown = JSON.parse(stored)
    if (!isRecord(parsed)) return {}

    const attribution: AttributionParams = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value && isAttributionQueryKey(key)) {
        attribution[key] = value
      }
    }

    return attribution
  } catch {
    return {}
  }
}

function persistAttribution(
  storage: Storage,
  attribution: AttributionParams
): void {
  try {
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution))
  } catch {
    return
  }
}

function resolveAttribution(
  storage: Storage,
  search: string
): AttributionParams {
  const stored = readStoredAttribution(storage)
  const fromUrl = readAttributionFromSearch(search)
  const attribution = { ...stored, ...fromUrl }

  if (hasAttribution(fromUrl)) {
    persistAttribution(storage, attribution)
  }

  return attribution
}

function shouldDecorateUrl(url: URL, currentOrigin: string): boolean {
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return false
  }

  if (url.origin === currentOrigin) {
    return true
  }

  return ATTRIBUTION_HOSTNAMES.has(url.hostname.toLowerCase())
}

function isRelativeHref(href: string): boolean {
  return href.startsWith('/') || href.startsWith('./') || href.startsWith('../')
}

export function withPreservedAttribution(
  href: string,
  attribution: AttributionParams,
  currentOrigin: string
): string {
  if (!hasAttribution(attribution) || href.startsWith('#')) {
    return href
  }

  let url: URL
  try {
    url = new URL(href, currentOrigin)
  } catch {
    return href
  }

  if (!shouldDecorateUrl(url, currentOrigin)) {
    return href
  }

  for (const [key, value] of Object.entries(attribution)) {
    url.searchParams.set(key, value)
  }

  if (isRelativeHref(href)) {
    return `${url.pathname}${url.search}${url.hash}`
  }

  return url.href
}

function decorateLinks(attribution: AttributionParams): void {
  const { origin } = window.location

  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = link.getAttribute('href')
    if (!href) continue

    const decoratedHref = withPreservedAttribution(href, attribution, origin)
    if (decoratedHref !== href) {
      link.setAttribute('href', decoratedHref)
    }
  }
}

export function initAttributionPersistence(): void {
  if (typeof window === 'undefined' || attributionPersistenceInitialized) return
  attributionPersistenceInitialized = true

  let scheduled = false

  const refreshLinks = () => {
    scheduled = false
    const attribution = resolveAttribution(
      window.sessionStorage,
      window.location.search
    )
    decorateLinks(attribution)
  }

  const scheduleRefresh = () => {
    if (scheduled) return
    scheduled = true
    window.queueMicrotask(refreshLinks)
  }

  const observer = new MutationObserver(scheduleRefresh)

  document.addEventListener('astro:page-load', refreshLinks)
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target
      if (!(target instanceof Element)) return

      const link = target.closest<HTMLAnchorElement>('a[href]')
      if (!link) return

      const href = link.getAttribute('href')
      if (!href) return

      const attribution = resolveAttribution(
        window.sessionStorage,
        window.location.search
      )
      link.setAttribute(
        'href',
        withPreservedAttribution(href, attribution, window.location.origin)
      )
    },
    { capture: true }
  )

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['href']
  })

  refreshLinks()
}
