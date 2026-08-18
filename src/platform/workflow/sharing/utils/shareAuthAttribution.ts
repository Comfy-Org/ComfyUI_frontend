import type { LocationQuery } from 'vue-router'

import { capturePreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

const SHARE_QUERY_KEY = 'share'
const MAX_SHARE_ID_LENGTH = 128
const SHARE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/

export function isValidShareId(shareId: string): boolean {
  return shareId.length <= MAX_SHARE_ID_LENGTH && SHARE_ID_PATTERN.test(shareId)
}

export function preserveLoggedOutShareAuthAttribution(
  query: LocationQuery,
  isLoggedIn: boolean
): void {
  if (isLoggedIn) return

  const shareId = query[SHARE_QUERY_KEY]
  if (typeof shareId !== 'string' || !isValidShareId(shareId)) return

  capturePreservedQuery(
    PRESERVED_QUERY_NAMESPACES.SHARE_AUTH,
    { [SHARE_QUERY_KEY]: shareId },
    [SHARE_QUERY_KEY]
  )
}
