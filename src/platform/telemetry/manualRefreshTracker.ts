import { datadogRum } from '@datadog/browser-rum'

const REFRESH_COUNT_KEY = 'Comfy.ManualRefreshCount'

function nextRefreshCount(sessionId: string): number {
  const [storedSessionId, storedCount] = (
    localStorage.getItem(REFRESH_COUNT_KEY) ?? ''
  ).split(':')
  const count = storedSessionId === sessionId ? Number(storedCount) + 1 : 1
  localStorage.setItem(REFRESH_COUNT_KEY, `${sessionId}:${count}`)
  return count
}

/**
 * Report a page reload as a RUM action carrying its running count within the
 * current RUM session, so refresh bursts are queryable by threshold.
 *
 * Must be called after `datadogRum.init()`, which is what makes the session id
 * available.
 */
export function trackUserManualRefresh(): void {
  const [navigationEntry] = performance.getEntriesByType(
    'navigation'
  ) as PerformanceNavigationTiming[]
  if (navigationEntry?.type !== 'reload') return

  const sessionId = datadogRum.getInternalContext()?.session_id
  if (!sessionId) return

  datadogRum.addAction('user_manual_refresh', {
    refresh_count: nextRefreshCount(sessionId)
  })
}
