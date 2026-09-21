import { effectScope } from 'vue'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import type { WorkshopRunAnalytics } from '../scripts/workshop-analytics'
import { captureWorkshopEvent } from '../scripts/posthog'
import { useWorkshopDelivery } from './useWorkshopDelivery'

vi.mock(import('../scripts/posthog'), () => ({ captureWorkshopEvent: vi.fn() }))

const analytics: WorkshopRunAnalytics = {
  model_slug: 'demo--image',
  attempt_id: 'attempt',
  user_id: 'user',
  workspace_id: 'workspace'
}
const output = {
  kind: 'image' as const,
  url: 'blob:output',
  fileName: 'result.png'
}

function tracker() {
  const scope = effectScope()
  const delivery = scope.run(useWorkshopDelivery)
  onTestFinished(() => scope.stop())
  if (!delivery) throw new Error('Missing delivery tracker')
  delivery.start(analytics, 'router-id', output)
  return delivery
}

describe('Workshop output delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })
  })

  it.for(['succeeded', 'failed'] as const)(
    'reports %s only once for the current primary output',
    (status) => {
      const delivery = tracker()
      delivery.settle('blob:previous-output', status)
      expect(captureWorkshopEvent).not.toHaveBeenCalled()
      delivery.settle(output.url, status)
      delivery.settle(output.url, status)
      expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
        name: 'delivery_finished',
        properties: expect.objectContaining({
          attempt_id: 'attempt',
          request_id: 'router-id',
          output_kind: 'image',
          status
        })
      })
    }
  )

  it('reports a media timeout after an HTTP success never loads', async () => {
    tracker()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'delivery_finished',
      properties: expect.objectContaining({
        status: 'failed',
        reason: 'media_timeout',
        failure_stage: 'delivery'
      })
    })
  })

  it('does not turn navigation into a model outage', async () => {
    const delivery = tracker()
    delivery.cancel()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'delivery_finished',
      properties: expect.objectContaining({ status: 'cancelled' })
    })
  })

  it('settles an abandoned primary output as cancelled, never as a timeout', async () => {
    const delivery = tracker()
    delivery.settle('blob:another-output', 'cancelled')
    expect(captureWorkshopEvent).not.toHaveBeenCalled()

    delivery.settle(output.url, 'cancelled')
    delivery.settle(output.url, 'succeeded')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
      name: 'delivery_finished',
      properties: expect.objectContaining({ status: 'cancelled' })
    })
    expect(vi.mocked(captureWorkshopEvent).mock.calls[0][0]).not.toHaveProperty(
      'properties.reason'
    )
  })

  it('does not classify a hidden-page deadline as media failure', async () => {
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    tracker()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(captureWorkshopEvent).toHaveBeenCalledWith({
      name: 'delivery_finished',
      properties: expect.objectContaining({ status: 'cancelled' })
    })
  })

  it('keeps protected outputs unverified instead of failing their load timer', async () => {
    const delivery = tracker()
    delivery.start(analytics, 'new-id', { ...output, nsfw: true })
    vi.mocked(captureWorkshopEvent).mockClear()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })
})
