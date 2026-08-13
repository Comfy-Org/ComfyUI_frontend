import type { RouteLocation, RouteLocationRaw } from 'vue-router'

import { useTelemetry } from '@/platform/telemetry'

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
  useTelemetry()?.reportError(new Error('Unmatched route'), {
    error_type: 'unmatched_route',
    level: 'warning',
    context: { path: to.path }
  })

  return '/'
}
