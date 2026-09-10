import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  bindOperationToCheckoutJourney,
  clearCheckoutJourney,
  createCheckoutJourneyRecord,
  getActiveCheckoutJourney,
  resolveCheckoutAssignment,
  resolveCheckoutJourney,
  toCheckoutJourneyContext
} from './checkoutJourney'
import type { StartCheckoutJourneyInput } from './checkoutJourney'

const STORAGE_KEY = 'comfy.checkout.journey'

const baseInput: StartCheckoutJourneyInput = {
  actorUid: 'user-1',
  workspaceId: 'ws-1',
  entryFlow: 'initial_subscription',
  entrySource: 'pricing',
  assignment: { status: 'resolved', arm: 'treatment' }
}

beforeEach(() => {
  sessionStorage.clear()
  clearCheckoutJourney()
})

describe('resolveCheckoutAssignment', () => {
  it('freezes treatment when the flag resolved true', () => {
    expect(
      resolveCheckoutAssignment({ embedded_checked_enabled: true })
    ).toEqual({ status: 'resolved', arm: 'treatment' })
  })

  it('freezes control when the flag resolved false', () => {
    expect(
      resolveCheckoutAssignment({ embedded_checked_enabled: false })
    ).toEqual({ status: 'resolved', arm: 'control' })
  })

  it('reports unavailable when the flag is absent rather than inventing control', () => {
    expect(resolveCheckoutAssignment({})).toEqual({ status: 'unavailable' })
  })
})

describe('createCheckoutJourneyRecord', () => {
  it('freezes entry context and the resolved arm', () => {
    const record = createCheckoutJourneyRecord(baseInput, 1_700_000_000_000)
    expect(record).toMatchObject({
      actor_uid: 'user-1',
      workspace_id: 'ws-1',
      entry_flow: 'initial_subscription',
      entry_source: 'pricing',
      assignment_status: 'resolved',
      assigned_arm: 'treatment',
      entered_at: new Date(1_700_000_000_000).toISOString()
    })
  })

  it('omits the arm when assignment is unavailable', () => {
    const record = createCheckoutJourneyRecord(
      { ...baseInput, assignment: { status: 'unavailable' } },
      1_700_000_000_000
    )
    expect(record.assignment_status).toBe('unavailable')
    expect('assigned_arm' in record).toBe(false)
  })
})

describe('resolveCheckoutJourney', () => {
  it('starts a new journey when none is in flight', () => {
    const { resumed, record } = resolveCheckoutJourney(baseInput)
    expect(resumed).toBe(false)
    expect(getActiveCheckoutJourney()?.journey_id).toBe(record.journey_id)
  })

  it('resumes the same journey for the same actor, workspace, and flow', () => {
    const first = resolveCheckoutJourney(baseInput)
    const second = resolveCheckoutJourney(baseInput)
    expect(second.resumed).toBe(true)
    expect(second.record.journey_id).toBe(first.record.journey_id)
    expect(second.record.entered_at).toBe(first.record.entered_at)
  })

  it('does not inherit a prior journey after a workspace switch', () => {
    const first = resolveCheckoutJourney(baseInput)
    const second = resolveCheckoutJourney({ ...baseInput, workspaceId: 'ws-2' })
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it('does not inherit a prior journey after a different sign-in', () => {
    const first = resolveCheckoutJourney(baseInput)
    const second = resolveCheckoutJourney({ ...baseInput, actorUid: 'user-2' })
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it('starts a new journey when the purchase intent changes', () => {
    const first = resolveCheckoutJourney(baseInput)
    const second = resolveCheckoutJourney({ ...baseInput, entryFlow: 'topup' })
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it('does not resume an expired journey', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T00:00:00.000Z'))
    const first = resolveCheckoutJourney(baseInput)

    vi.setSystemTime(new Date('2026-09-10T01:00:00.000Z'))
    const second = resolveCheckoutJourney(baseInput)
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })
})

describe('bindOperationToCheckoutJourney', () => {
  it('attaches the operation id to the active journey', () => {
    resolveCheckoutJourney(baseInput)
    const bound = bindOperationToCheckoutJourney('op-1')
    expect(bound?.billing_op_id).toBe('op-1')
    expect(getActiveCheckoutJourney()?.billing_op_id).toBe('op-1')
  })

  it('is a no-op when no journey is active', () => {
    expect(bindOperationToCheckoutJourney('op-1')).toBeNull()
  })
})

describe('toCheckoutJourneyContext', () => {
  it('maps the record to a telemetry context and omits absent fields', () => {
    const { record } = resolveCheckoutJourney({
      ...baseInput,
      assignment: { status: 'unavailable' }
    })
    const context = toCheckoutJourneyContext(record)
    expect(context).toMatchObject({
      checkout_journey_id: record.journey_id,
      assignment_status: 'unavailable',
      entry_flow: 'initial_subscription',
      entry_source: 'pricing'
    })
    expect('assigned_arm' in context).toBe(false)
    expect('billing_op_id' in context).toBe(false)
  })
})

describe('purchase intent boundary', () => {
  it('starts a new journey when the intent key changes', () => {
    const first = resolveCheckoutJourney({
      ...baseInput,
      intent: 'standard:monthly'
    })
    const second = resolveCheckoutJourney({
      ...baseInput,
      intent: 'pro:monthly'
    })
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it('resumes when the intent key is unchanged', () => {
    const first = resolveCheckoutJourney({
      ...baseInput,
      intent: 'standard:monthly'
    })
    const second = resolveCheckoutJourney({
      ...baseInput,
      intent: 'standard:monthly'
    })
    expect(second.resumed).toBe(true)
    expect(second.record.journey_id).toBe(first.record.journey_id)
  })
})

describe('assignment invariant on persisted records', () => {
  it('discards a resolved record with no arm', () => {
    const record = createCheckoutJourneyRecord(baseInput, Date.now())
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...record, assigned_arm: undefined })
    )
    expect(getActiveCheckoutJourney()).toBeNull()
  })

  it('discards an unavailable record that carries an arm', () => {
    const record = createCheckoutJourneyRecord(
      { ...baseInput, assignment: { status: 'unavailable' } },
      Date.now()
    )
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...record, assigned_arm: 'control' })
    )
    expect(getActiveCheckoutJourney()).toBeNull()
  })
})

describe('resilience', () => {
  it('expires a persisted record on read', () => {
    const stale = createCheckoutJourneyRecord(baseInput, Date.now())
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...stale,
        started_at_ms: Date.now() - 25 * 60 * 60 * 1000
      })
    )
    expect(getActiveCheckoutJourney()).toBeNull()
  })

  it('keeps the active journey when session storage is wiped mid-session', () => {
    const { record } = resolveCheckoutJourney(baseInput)
    sessionStorage.removeItem(STORAGE_KEY)
    expect(getActiveCheckoutJourney()?.journey_id).toBe(record.journey_id)
  })

  it('prefers the in-memory journey when a replacement write fails', () => {
    resolveCheckoutJourney({ ...baseInput, intent: 'a' })
    const setItem = vi
      .spyOn(sessionStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded')
      })

    const { record } = resolveCheckoutJourney({ ...baseInput, intent: 'b' })
    setItem.mockRestore()

    expect(record.intent).toBe('b')
    expect(getActiveCheckoutJourney()?.journey_id).toBe(record.journey_id)
  })
})

describe('corrupt storage', () => {
  it('discards an unparseable record and starts fresh', () => {
    sessionStorage.setItem(STORAGE_KEY, '{not json')
    expect(getActiveCheckoutJourney()).toBeNull()
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('discards a structurally invalid record', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ journey_id: 1 }))
    expect(getActiveCheckoutJourney()).toBeNull()
  })

  it('clears the active journey', () => {
    resolveCheckoutJourney(baseInput)
    clearCheckoutJourney()
    expect(getActiveCheckoutJourney()).toBeNull()
  })
})
