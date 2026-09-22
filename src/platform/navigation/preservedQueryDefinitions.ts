import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'
import type { PreservedQueryDefinition } from '@/platform/navigation/preservedQueryTracker'

/**
 * What the router stashes before a navigation drops the query, so a deep link
 * survives the sign-in and onboarding redirects. A namespace that only appears
 * in `PRESERVED_QUERY_NAMESPACES` is never captured: hydrating it later finds
 * an empty stash and the intent is lost, so a loader that hydrates a namespace
 * belongs in this list too.
 */
export const PRESERVED_QUERY_DEFINITIONS: PreservedQueryDefinition[] = [
  {
    namespace: PRESERVED_QUERY_NAMESPACES.TEMPLATE,
    keys: ['template', 'source', 'mode']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.SHARE,
    keys: ['share']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.INVITE,
    keys: ['invite']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.CREATE_WORKSPACE,
    keys: ['create_workspace']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.OAUTH,
    keys: ['oauth_request_id']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.PRICING,
    keys: ['pricing', 'stop', 'cycle'],
    requiredKey: 'pricing'
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.TOPUP,
    keys: ['topup']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.SETTINGS,
    keys: ['settings']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.ASSETS,
    keys: ['assets']
  },
  {
    namespace: PRESERVED_QUERY_NAMESPACES.DESKTOP_LOGIN,
    keys: ['desktop_login_code'],
    stripAfterCapture: true
  }
]
