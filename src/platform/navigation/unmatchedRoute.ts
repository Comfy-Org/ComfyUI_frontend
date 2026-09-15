import type { RouteLocation, RouteLocationRaw } from 'vue-router'

import { reportError } from '@/platform/telemetry/reportError'

/**
 * An unmatched path is attacker-supplied and unbounded, so it is truncated
 * before it reaches telemetry. It is not redacted: every route in this app is
 * a static literal with no parameter segments, and OAuth/share state travels
 * in the query string, which `to.path` excludes — so a path segment carries no
 * secret material, and the specific bad URL is the whole diagnostic value.
 */
const MAX_REPORTED_PATH_LENGTH = 128

/**
 * Unknown paths redirect to root rather than hanging on the splash screen with
 * no route match. The global auth guard then routes unauthenticated users to
 * /cloud/login as normal.
 *
 * The Error message is deliberately static so every unmatched path groups into
 * one issue; the path itself rides along as context, where high cardinality is
 * cheap and a spike is still attributable.
 */
export function unmatchedRouteRedirect(to: RouteLocation): RouteLocationRaw {
  reportError(new Error('Unmatched route'), {
    errorType: 'unmatched_route',
    level: 'warning',
    context: { path: to.path.slice(0, MAX_REPORTED_PATH_LENGTH) }
  })

  return '/'
}
