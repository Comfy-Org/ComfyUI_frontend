import type { LocationQuery } from 'vue-router'

import { getPreservedQueryParam } from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

const firstNonEmpty = (value: LocationQuery[string]): string | undefined => {
  const raw = Array.isArray(value) ? value[0] : value
  return raw ? raw : undefined
}

const hasInviteInFlight = (query: LocationQuery): boolean => {
  const fromQuery = firstNonEmpty(query.invite)
  if (fromQuery) return true
  return !!getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.INVITE, 'invite')
}

/**
 * A brand-new invitee has no account, so sending them to login strands them on
 * a Firebase `user-not-found`. While an invite is in flight — carried on the
 * live query or already stashed by the preserved-query tracker for a later hop
 * — route the unauthenticated visitor to signup instead.
 */
export const resolveUnauthenticatedRedirectName = (
  query: LocationQuery
): 'cloud-login' | 'cloud-signup' => {
  return hasInviteInFlight(query) ? 'cloud-signup' : 'cloud-login'
}
