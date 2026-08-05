import { describe, expect, it } from 'vitest'

import type { BillingEvent } from '@/platform/workspace/api/workspaceApi'
import {
  billingEventToActivity,
  isUsageEvent
} from '@/platform/workspace/utils/billingEventToActivity'

const labels = {
  cloudRun: 'Cloud workflow run',
  partnerNode: 'Partner node usage'
}

function event(overrides: Partial<BillingEvent>): BillingEvent {
  return {
    event_type: 'gpu_usage',
    event_id: 'event-default',
    createdAt: '2026-07-14T00:00:00Z',
    ...overrides
  }
}

function resolveName(userId: string | undefined): string {
  return userId === 'user-1' ? 'Ada Lovelace' : (userId ?? '')
}

describe('billingEventToActivity', () => {
  it('keeps supported usage event types', () => {
    expect(isUsageEvent(event({ event_type: 'gpu_usage' }))).toBe(true)
    expect(isUsageEvent(event({ event_type: 'api_node_usage' }))).toBe(true)
    expect(isUsageEvent(event({ event_type: 'invoice_paid' }))).toBe(false)
  })

  it('maps GPU usage to an attributed cloud workflow run', () => {
    const row = billingEventToActivity(
      event({
        event_id: 'gpu-event-1',
        params: { user_id: 'user-1' },
        createdAt: '2026-07-14T09:32:00Z'
      }),
      resolveName,
      labels
    )

    expect(row).toMatchObject({
      id: 'gpu-event-1',
      userId: 'user-1',
      userName: 'Ada Lovelace',
      eventType: 'Cloud workflow run',
      credits: 0,
      credited: false
    })
    expect(row.date.toISOString()).toBe('2026-07-14T09:32:00.000Z')
  })

  it('maps partner usage with its partner node', () => {
    const row = billingEventToActivity(
      event({
        event_type: 'api_node_usage',
        event_id: 'partner-event-1',
        params: { user_id: 'user-1', partner_node: 'Flux Pro 1.1 Ultra' }
      }),
      resolveName,
      labels
    )

    expect(row.eventType).toBe('Partner node usage')
    expect(row.partnerNode).toBe('Flux Pro 1.1 Ultra')
  })

  it('keeps unattributed events workspace-scoped', () => {
    const row = billingEventToActivity(
      event({ event_id: 'unattributed-event-1', params: {} }),
      resolveName,
      labels
    )

    expect(row.userId).toBeNull()
    expect(row.userName).toBe('')
  })
})
