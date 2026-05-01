import type { LocationQuery, LocationQueryRaw } from 'vue-router'

const CLICK_ID_QUERY_KEYS = new Set([
  'im_ref',
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ttclid',
  'li_fat_id'
])

function isAttributionQueryKey(key: string): boolean {
  return key.startsWith('utm_') || CLICK_ID_QUERY_KEYS.has(key)
}

function attributionQueryFrom(query: LocationQuery): LocationQueryRaw {
  const attributionQuery: LocationQueryRaw = {}

  for (const [key, value] of Object.entries(query)) {
    if (isAttributionQueryKey(key) && value !== null) {
      attributionQuery[key] = value
    }
  }

  return attributionQuery
}

function hasQuery(query: LocationQueryRaw): boolean {
  return Object.keys(query).length > 0
}

export function buildCloudLoginRedirectQuery(
  fullPath: string,
  query: LocationQuery
): LocationQueryRaw | undefined {
  const attributionQuery = attributionQueryFrom(query)

  if (fullPath === '/') {
    return hasQuery(attributionQuery) ? attributionQuery : undefined
  }

  return {
    previousFullPath: encodeURIComponent(fullPath),
    ...attributionQuery
  }
}
