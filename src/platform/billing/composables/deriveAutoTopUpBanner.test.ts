import { describe, expect, it } from 'vitest'

import type { AutoTopUpBannerInput } from './deriveAutoTopUpBanner'
import { deriveAutoTopUpBanner } from './deriveAutoTopUpBanner'

const failedOwner: AutoTopUpBannerInput = {
  enabled: true,
  canManageAutoTopUp: true,
  isPaused: false,
  hasActivePlan: true,
  status: 'failed',
  disabledReason: null
}

describe('deriveAutoTopUpBanner', () => {
  it.for([
    { name: 'failed', overrides: {}, kind: 'autoTopUpFailed' },
    {
      name: 'turned off after consecutive declines',
      overrides: { disabledReason: 'consecutive_declines' },
      kind: 'autoTopUpOff'
    },
    {
      name: 'failed with an unknown disabled reason',
      overrides: { disabledReason: 'other' },
      kind: 'autoTopUpFailed'
    },
    { name: 'a member', overrides: { canManageAutoTopUp: false }, kind: null },
    { name: 'the flag off', overrides: { enabled: false }, kind: null },
    { name: 'a paused workspace', overrides: { isPaused: true }, kind: null },
    { name: 'no active plan', overrides: { hasActivePlan: false }, kind: null },
    { name: 'status on', overrides: { status: 'on' }, kind: null },
    { name: 'status on_hold', overrides: { status: 'on_hold' }, kind: null },
    {
      name: 'status paused_by_budget',
      overrides: { status: 'paused_by_budget' },
      kind: null
    },
    { name: 'status off', overrides: { status: 'off' }, kind: null },
    { name: 'no read yet', overrides: { status: null }, kind: null },
    {
      name: 'consecutive declines without failed status',
      overrides: { status: 'off', disabledReason: 'consecutive_declines' },
      kind: null
    }
  ] as const)('$name -> $kind', ({ overrides, kind }) => {
    expect(deriveAutoTopUpBanner({ ...failedOwner, ...overrides })).toBe(kind)
  })
})
