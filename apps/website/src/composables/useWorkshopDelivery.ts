import { onScopeDispose } from 'vue'

import type { RunOutput } from '../config/workshop-run'
import type { WorkshopRunAnalytics } from '../scripts/workshop-analytics'
import { captureWorkshopEvent } from '../scripts/posthog'

export type WorkshopDeliveryStatus =
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'unverified'

export function useWorkshopDelivery() {
  let pending:
    | {
        analytics: WorkshopRunAnalytics
        requestId: string | null
        startedAt: number
        output: RunOutput
        timer: ReturnType<typeof setTimeout>
      }
    | undefined

  function finish(
    status: WorkshopDeliveryStatus,
    reason?: 'media_error' | 'media_timeout'
  ) {
    if (!pending) return
    const delivery = pending
    pending = undefined
    clearTimeout(delivery.timer)
    captureWorkshopEvent({
      name: 'delivery_finished',
      properties: {
        ...delivery.analytics,
        request_id: delivery.requestId ?? undefined,
        duration_ms: Date.now() - delivery.startedAt,
        output_kind: delivery.output.kind,
        status,
        ...(reason ? { reason, failure_stage: 'delivery' } : {})
      }
    })
  }

  function cancel() {
    finish('cancelled')
  }

  function start(
    analytics: WorkshopRunAnalytics,
    requestId: string | null,
    output: RunOutput
  ) {
    cancel()
    pending = {
      analytics,
      requestId,
      output,
      startedAt: Date.now(),
      timer: setTimeout(() => {
        if (document.visibilityState === 'hidden') finish('cancelled')
        else finish('failed', 'media_timeout')
      }, 120_000)
    }
    if (output.nsfw || !['image', 'video', 'audio'].includes(output.kind))
      finish('unverified')
  }

  // `cancelled` is the media element for that URL being torn down before it
  // reported: the visitor moved to another output, not a delivery failure.
  function settle(url: string, status: 'succeeded' | 'failed' | 'cancelled') {
    if (url !== (pending?.output.urls?.[0] ?? pending?.output.url)) return
    finish(status, status === 'failed' ? 'media_error' : undefined)
  }

  onScopeDispose(cancel)
  return { start, settle, cancel }
}
