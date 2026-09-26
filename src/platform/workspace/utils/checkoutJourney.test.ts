import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckoutEntrySource } from '@/platform/telemetry/types'

import {
  bindOperationToCheckoutJourney,
  clearCheckoutJourney,
  createCheckoutJourneyRecord,
  getActiveCheckoutJourney,
  resolveCheckoutAssignment,
  resolveCheckoutJourney,
  resolveEntrySource,
  toCheckoutJourneyContext
} from './checkoutJourney'
import type {
  ResolveCheckoutJourneyResult,
  StartCheckoutJourneyInput
} from './checkoutJourney'

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

function activeJourney(
  input: StartCheckoutJourneyInput
): Extract<ResolveCheckoutJourneyResult, { status: 'active' }> {
  const result = resolveCheckoutJourney(input)
  if (result.status !== 'active') {
    throw new Error(`expected an active journey, got ${result.status}`)
  }
  return result
}

describe('resolveCheckoutJourney', () => {
  it('starts a new journey when none is in flight', () => {
    const { resumed, record } = activeJourney(baseInput)
    expect(resumed).toBe(false)
    expect(getActiveCheckoutJourney()?.journey_id).toBe(record.journey_id)
  })

  it('resumes the same journey for the same actor, workspace, and flow', () => {
    const first = activeJourney(baseInput)
    const second = activeJourney(baseInput)
    expect(second.resumed).toBe(true)
    expect(second.record.journey_id).toBe(first.record.journey_id)
    expect(second.record.entered_at).toBe(first.record.entered_at)
  })

  it('does not inherit a prior journey after a workspace switch', () => {
    const first = activeJourney(baseInput)
    const second = activeJourney({ ...baseInput, workspaceId: 'ws-2' })
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it('does not inherit a prior journey after a different sign-in', () => {
    const first = activeJourney(baseInput)
    const second = activeJourney({ ...baseInput, actorUid: 'user-2' })
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it('starts a new journey when the purchase intent changes', () => {
    const first = activeJourney(baseInput)
    const second = activeJourney({ ...baseInput, entryFlow: 'topup' })
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it('does not resume an expired journey', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-09T00:00:00.000Z'))
    const first = activeJourney(baseInput)

    vi.setSystemTime(new Date('2026-09-10T01:00:00.000Z'))
    const second = activeJourney(baseInput)
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it.for([
    // Infinity survives JSON.parse and makes every expiry comparison false.
    { field: 'started_at_ms', value: 1e400 },
    { field: 'entered_at', value: 'not-a-timestamp' }
  ])(
    'discards a persisted record with an invalid $field',
    ({ field, value }) => {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          journey_id: 'journey-1',
          entered_at: '2026-09-09T00:00:00.000Z',
          started_at_ms: Date.now(),
          actor_uid: 'user-1',
          workspace_id: 'ws-1',
          entry_flow: 'initial_subscription',
          entry_source: 'pricing',
          assignment_status: 'unavailable',
          [field]: value
        })
      )

      expect(getActiveCheckoutJourney()).toBeNull()
    }
  )

  it('does not resurrect a journey whose removal from storage failed', () => {
    activeJourney(baseInput)
    vi.spyOn(sessionStorage, 'removeItem').mockImplementation(() => {
      throw new Error('quota')
    })

    clearCheckoutJourney()

    // The record is still persisted, but this session ended it.
    expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(getActiveCheckoutJourney()).toBeNull()
  })

  it('blocks a different rail rather than lending it a bound journey', () => {
    const subscription = activeJourney(baseInput)
    bindOperationToCheckoutJourney('op-1')

    const topup = resolveCheckoutJourney({ ...baseInput, entryFlow: 'topup' })
    // The top-up rail gets no journey at all: emitting its phases against the
    // subscription record would file them under the subscription entry flow.
    expect(topup.status).toBe('blocked')
    expect(getActiveCheckoutJourney()?.journey_id).toBe(
      subscription.record.journey_id
    )
    expect(getActiveCheckoutJourney()?.billing_op_id).toBe('op-1')
  })

  it('blocks a same-rail entry under a different intent rather than evicting a bound journey', () => {
    const first = activeJourney({
      ...baseInput,
      entryFlow: 'topup',
      intent: 'settings_billing'
    })
    bindOperationToCheckoutJourney('op-1')

    const second = resolveCheckoutJourney({
      ...baseInput,
      entryFlow: 'topup',
      intent: 'agent_paywall'
    })

    expect(second.status).toBe('blocked')
    expect(getActiveCheckoutJourney()?.journey_id).toBe(first.record.journey_id)
    expect(getActiveCheckoutJourney()?.intent).toBe('settings_billing')
    expect(getActiveCheckoutJourney()?.billing_op_id).toBe('op-1')
  })

  it('starts a new journey under a different intent once nothing is bound', () => {
    const first = activeJourney({
      ...baseInput,
      entryFlow: 'topup',
      intent: 'settings_billing'
    })

    const second = activeJourney({
      ...baseInput,
      entryFlow: 'topup',
      intent: 'agent_paywall'
    })

    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
    expect(second.record.intent).toBe('agent_paywall')
  })

  it('still starts a fresh journey for a different rail when none is bound', () => {
    const subscription = activeJourney(baseInput)
    const topup = activeJourney({ ...baseInput, entryFlow: 'topup' })
    expect(topup.resumed).toBe(false)
    expect(topup.record.journey_id).not.toBe(subscription.record.journey_id)
  })
})

describe('bindOperationToCheckoutJourney', () => {
  it('attaches the operation id to the active journey', () => {
    activeJourney(baseInput)
    const bound = bindOperationToCheckoutJourney('op-1')
    expect(bound?.billing_op_id).toBe('op-1')
    expect(getActiveCheckoutJourney()?.billing_op_id).toBe('op-1')
  })

  it('is a no-op when no journey is active', () => {
    expect(bindOperationToCheckoutJourney('op-1')).toBeNull()
  })

  it('refuses to rebind a journey already bound to another operation', () => {
    activeJourney(baseInput)
    bindOperationToCheckoutJourney('op-1')

    expect(bindOperationToCheckoutJourney('op-2')).toBeNull()
    expect(getActiveCheckoutJourney()?.billing_op_id).toBe('op-1')
  })
})

describe('toCheckoutJourneyContext', () => {
  it('maps the record to a telemetry context and omits absent fields', () => {
    const { record } = activeJourney({
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
    const first = activeJourney({
      ...baseInput,
      intent: 'standard:monthly'
    })
    const second = activeJourney({
      ...baseInput,
      intent: 'pro:monthly'
    })
    expect(second.resumed).toBe(false)
    expect(second.record.journey_id).not.toBe(first.record.journey_id)
  })

  it('resumes when the intent key is unchanged', () => {
    const first = activeJourney({
      ...baseInput,
      intent: 'standard:monthly'
    })
    const second = activeJourney({
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
    const { record } = activeJourney(baseInput)
    sessionStorage.removeItem(STORAGE_KEY)
    expect(getActiveCheckoutJourney()?.journey_id).toBe(record.journey_id)
  })

  it('prefers the in-memory journey when a replacement write fails', () => {
    activeJourney({ ...baseInput, intent: 'a' })
    const setItem = vi
      .spyOn(sessionStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded')
      })

    const { record } = activeJourney({ ...baseInput, intent: 'b' })
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
    activeJourney(baseInput)
    clearCheckoutJourney()
    expect(getActiveCheckoutJourney()).toBeNull()
  })
})

describe('entry source attribution across rehydration', () => {
  const ENTRY_SOURCES: CheckoutEntrySource[] = [
    'pricing',
    'deep_link',
    'recovery',
    'settings_billing',
    'other',
    'unknown',
    'agent_paywall'
  ]

  function persistHostedJourney(entrySource: CheckoutEntrySource): void {
    const { record } = activeJourney({
      ...baseInput,
      entrySource,
      uiMode: 'hosted'
    })
    const persisted = sessionStorage.getItem(STORAGE_KEY)
    clearCheckoutJourney()
    sessionStorage.setItem(STORAGE_KEY, persisted ?? '')
    expect(record.entry_source).toBe(entrySource)
  }

  it.for(ENTRY_SOURCES)(
    'carries %s from a persisted hosted journey into the resumed telemetry context',
    (entrySource) => {
      persistHostedJourney(entrySource)

      const rehydrated = getActiveCheckoutJourney()

      expect(rehydrated?.entry_source).toBe(entrySource)
      expect(toCheckoutJourneyContext(rehydrated!)).toMatchObject({
        entry_source: entrySource,
        ui_mode: 'hosted'
      })

      // The hop R4 joins on: binding rewrites the persisted record and every
      // later phase re-reads it.
      const bound = bindOperationToCheckoutJourney('op-rehydrated')

      expect(bound?.entry_source).toBe(entrySource)
      expect(toCheckoutJourneyContext(bound!)).toMatchObject({
        entry_source: entrySource,
        billing_op_id: 'op-rehydrated',
        ui_mode: 'hosted'
      })
    }
  )

  it('resumes the persisted agent-paywall journey rather than starting a new one', () => {
    persistHostedJourney('agent_paywall')

    const resumed = activeJourney({
      ...baseInput,
      entrySource: 'agent_paywall',
      uiMode: 'hosted'
    })

    expect(resumed.resumed).toBe(true)
    expect(resumed.record.entry_source).toBe('agent_paywall')
  })

  it('still degrades an unrecognised persisted entry source to unknown', () => {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        journey_id: 'journey-1',
        entered_at: '2026-09-09T00:00:00.000Z',
        started_at_ms: Date.now(),
        actor_uid: 'user-1',
        workspace_id: 'ws-1',
        entry_flow: 'initial_subscription',
        entry_source: 'not_a_source',
        assignment_status: 'unavailable'
      })
    )

    expect(getActiveCheckoutJourney()?.entry_source).toBe('unknown')
  })
})

describe('resolveEntrySource', () => {
  it('pins the agent paywall entry source from its payment intent source', () => {
    expect(resolveEntrySource('agent_paywall', 'pricing')).toBe('agent_paywall')
    expect(resolveEntrySource('agent_paywall', 'settings_billing')).toBe(
      'agent_paywall'
    )
  })

  it.for([
    'subscription_required',
    'out_of_credits',
    'deep_link',
    'free_tier_quota',
    undefined
  ] as const)(
    'leaves the rail default in place for %s so existing attribution is unchanged',
    (paymentIntentSource) => {
      expect(resolveEntrySource(paymentIntentSource, 'pricing')).toBe('pricing')
      expect(resolveEntrySource(paymentIntentSource, 'settings_billing')).toBe(
        'settings_billing'
      )
    }
  )
})

describe('resolveEntrySource prototype safety', () => {
  it.for(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'falls back rather than resolving the inherited %s member',
    (key) => {
      expect(resolveEntrySource(key, 'settings_billing')).toBe(
        'settings_billing'
      )
    }
  )
})
