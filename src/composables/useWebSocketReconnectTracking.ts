import * as Sentry from '@sentry/vue'

import { useQueueStore } from '@/stores/queueStore'

/**
 * Tracks WebSocket disconnect/reconnect events via Sentry for incident-39
 * observability. Captures disconnect duration and whether jobs were in flight
 * when the connection dropped.
 */
export function useWebSocketReconnectTracking() {
  const queueStore = useQueueStore()

  let disconnectedAt: number | null = null
  let activeJobCountAtDisconnect = 0

  function onDisconnect() {
    if (disconnectedAt !== null) return

    disconnectedAt = performance.now()
    // Includes both pending and running tasks. Pending tasks matter because
    // their pending->running transition is delivered via WebSocket -- if the
    // connection drops while tasks are queued, the user never sees them start.
    activeJobCountAtDisconnect = queueStore.activeJobsCount
  }

  function onReconnect() {
    if (disconnectedAt === null) return

    const durationMs = Math.round(performance.now() - disconnectedAt)
    const hadActiveJobs = activeJobCountAtDisconnect > 0

    Sentry.addBreadcrumb({
      category: 'websocket',
      message: 'WebSocket reconnected',
      level: 'info',
      data: {
        disconnect_duration_ms: durationMs,
        had_active_jobs: hadActiveJobs,
        active_job_count: activeJobCountAtDisconnect
      }
    })

    if (hadActiveJobs) {
      Sentry.captureMessage('WebSocket reconnected with active jobs', {
        level: 'warning',
        tags: {
          incident: 'incident-39'
        },
        extra: {
          disconnect_duration_ms: durationMs,
          active_job_count: activeJobCountAtDisconnect
        }
      })
    }

    disconnectedAt = null
    activeJobCountAtDisconnect = 0
  }

  function reset() {
    disconnectedAt = null
    activeJobCountAtDisconnect = 0
  }

  return { onDisconnect, onReconnect, reset }
}
