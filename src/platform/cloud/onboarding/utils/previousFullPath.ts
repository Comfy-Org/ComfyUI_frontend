import type { LocationQuery } from 'vue-router'

import { safeInternalPath } from '@comfyorg/account/redirect'

const decodeQueryParam = (value: string): string | null => {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}

export const getSafePreviousFullPath = (
  query: LocationQuery
): string | null => {
  const raw = query.previousFullPath
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value) return null

  const decoded = decodeQueryParam(value)
  if (!decoded) return null

  return safeInternalPath(decoded, window.location.origin, '') || null
}
