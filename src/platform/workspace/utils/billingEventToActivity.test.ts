import { describe, expect, it } from 'vitest'

import type { BillingEventInput } from '@/platform/workspace/utils/billingEventToActivity'
import {
  billingEventToActivity,
  isUsageEvent
} from '@/platform/workspace/utils/billingEventToActivity'

const labels = {
  cloudRun: 'Cloud workflow run',
  partnerNode: 'Partner node usage'
}

const nameById: Record<string, string> = { 'user-1': 'Ada Lovelace' }

function resolveName(userId: string | undefined): string {
  if (!userId) return ''
  return nameById[userId] ?? userId
}

function event(overrides: Partial<BillingEventInput>): BillingEventInput {
  return {
    event_type: 'gpu_usage',
    event_id: 'evt',
    createdAt: '2026-07-14T00:00:00Z',
    ...overrides
  }
}

describe('isUsageEvent', () => {
  it('keeps gpu and api-node usage and drops non-usage events', () => {
    expect(isUsageEvent(event({ event_type: 'gpu_usage' }))).toBe(true)
    expect(isUsageEvent(event({ event_type: 'api_node_usage' }))).toBe(true)
    expect(isUsageEvent(event({ event_type: 'invoice_paid' }))).toBe(false)
  })
})

describe('billingEventToActivity', () => {
  it('maps a GPU usage row to a cloud-run entry attributed to its member', () => {
    const row = billingEventToActivity(
      event({
        event_type: 'gpu_usage',
        event_id: 'evt-1',
        createdAt: '2026-07-14T09:32:00Z',
        params: { user_id: 'user-1', gpu_seconds: 12 }
      }),
      resolveName,
      labels
    )
    expect(row).toMatchObject({
      id: 'evt-1',
      userName: 'Ada Lovelace',
      eventType: 'Cloud workflow run',
      credits: 0,
      credited: false
    })
    expect(row.date.toISOString()).toBe('2026-07-14T09:32:00.000Z')
    expect(row.partnerNode).toBeUndefined()
  })

  it('maps a partner usage row with its partner node', () => {
    const row = billingEventToActivity(
      event({
        event_type: 'api_node_usage',
        event_id: 'evt-2',
        params: { user_id: 'user-1', partner_node: 'Flux Pro 1.1 Ultra' }
      }),
      resolveName,
      labels
    )
    expect(row.eventType).toBe('Partner node usage')
    expect(row.partnerNode).toBe('Flux Pro 1.1 Ultra')
  })

  it('leaves the user name empty when the event has no user_id', () => {
    const row = billingEventToActivity(
      event({ event_id: 'evt-3', params: {} }),
      resolveName,
      labels
    )
    expect(row.userName).toBe('')
  })
})
