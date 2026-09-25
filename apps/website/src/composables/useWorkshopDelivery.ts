import { onScopeDispose } from 'vue'
import { useEventListener } from '@vueuse/core'

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
        deadlineStarted: boolean
        startedAt: number
        output: RunOutput
        timer: ReturnType<typeof setTimeout> | undefined
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
    finish(
      pending?.output.kind === 'audio' && !pending.deadlineStarted
        ? 'unverified'
        : 'cancelled'
    )
  }

  function pauseDeadline() {
    if (pending?.timer === undefined) return
    clearTimeout(pending.timer)
    pending = { ...pending, timer: undefined }
  }

  function armDeadline() {
    if (!pending || pending.timer !== undefined) return
    pending = {
      ...pending,
      deadlineStarted: true,
      startedAt: Date.now(),
      timer: setTimeout(() => {
        if (document.visibilityState === 'hidden') pauseDeadline()
        else finish('failed', 'media_timeout')
      }, 120_000)
    }
  }

  function beginPlayback(url: string) {
    if (
      pending?.output.kind !== 'audio' ||
      url !== (pending.output.urls?.[0] ?? pending.output.url)
    )
      return
    if (document.visibilityState === 'hidden')
      pending = { ...pending, deadlineStarted: true }
    else armDeadline()
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
      deadlineStarted: output.kind !== 'audio',
      startedAt: Date.now(),
      timer: undefined
    }
    if (output.nsfw || !['image', 'video', 'audio'].includes(output.kind))
      finish('unverified')
    else if (document.visibilityState !== 'hidden' && output.kind !== 'audio')
      armDeadline()
  }

  // `cancelled` is the media element for that URL being torn down before it
  // reported: the visitor moved to another output, not a delivery failure.
  function settle(url: string, status: 'succeeded' | 'failed' | 'cancelled') {
    if (url !== (pending?.output.urls?.[0] ?? pending?.output.url)) return
    if (status === 'cancelled') return cancel()
    finish(status, status === 'failed' ? 'media_error' : undefined)
  }

  useEventListener(
    () => globalThis.document,
    'visibilitychange',
    () => {
      if (document.visibilityState === 'hidden') pauseDeadline()
      else if (pending?.deadlineStarted) armDeadline()
    }
  )
  onScopeDispose(cancel)
  return { start, beginPlayback, settle, cancel }
}
