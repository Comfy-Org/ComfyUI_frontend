import { expect, it, vi } from 'vitest'

import { captureWorkshopEvent } from './posthog'
import { captureWorkshopHealth } from './workshop-datadog'
import type { WorkshopAnalyticsEvent } from './workshop-analytics'

vi.mock(import('./workshop-datadog'), () => ({
  captureWorkshopHealth: vi.fn()
}))

it('reports operational failure even before PostHog initializes', () => {
  const event: WorkshopAnalyticsEvent = {
    name: 'run_finished',
    properties: {
      model_slug: 'demo',
      attempt_id: 'attempt',
      user_id: 'user',
      workspace_id: 'workspace',
      duration_ms: 1,
      status: 'failed',
      reason: 'response',
      http_status: 200,
      failure_stage: 'response'
    }
  }
  captureWorkshopEvent(event)
  expect(captureWorkshopHealth).toHaveBeenCalledExactlyOnceWith(event)
})
