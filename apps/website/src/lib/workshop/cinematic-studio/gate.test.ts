import { describe, expect, it } from 'vitest'

import type { StudioGate, StudioGateInput } from './gate'
import { canRunModel, studioGate } from './gate'
import { workshopContract } from '../../../config/workshop-contract-catalog'

const ready: StudioGateInput = {
  runEnabled: true,
  modelRunnable: true,
  mounted: true,
  authAvailable: true,
  sessionSettled: true,
  role: 'owner',
  credits: 100
}

describe('studioGate', () => {
  it.for<[string, Partial<StudioGateInput>, StudioGate]>([
    ['runs when everything is in place', {}, 'ready'],
    [
      'is unavailable when running is off',
      { runEnabled: false, mounted: false },
      'unavailable'
    ],
    [
      'is unavailable for a model that cannot run',
      { modelRunnable: false },
      'unavailable'
    ],
    ['waits for the island to mount', { mounted: false }, 'pending'],
    ['is unavailable without auth', { authAvailable: false }, 'unavailable'],
    ['waits for the session to settle', { sessionSettled: false }, 'pending'],
    ['asks a visitor to sign in', { role: undefined }, 'signedOut'],
    [
      'asks for sign-in before credits',
      { role: undefined, credits: 0 },
      'signedOut'
    ],
    ['runs before the balance is read', { credits: undefined }, 'ready'],
    ['asks an owner to buy credits', { credits: 0 }, 'noCredits'],
    [
      'tells a member the workspace is out',
      { credits: 0, role: 'member' },
      'memberNoCredits'
    ],
    ['runs an unpriced shot on any balance', { credits: 1 }, 'ready'],
    ['runs a shot the balance covers', { credits: 24, cost: 24 }, 'ready'],
    [
      'blocks an owner below the estimate',
      { credits: 23, cost: 24 },
      'noCredits'
    ],
    [
      'blocks a member below the estimate',
      { credits: 23, cost: 24, role: 'member' },
      'memberNoCredits'
    ]
  ])('%s', ([, overrides, expected]) => {
    expect(studioGate({ ...ready, ...overrides })).toBe(expected)
  })
})

describe('canRunModel', () => {
  const execution = workshopContract('bfl/flux-2-pro')

  it.for([
    ['runs a model with a Router contract', { execution }, true],
    ['refuses a model without a contract', {}, false],
    [
      'refuses a model missing its input schema',
      { execution, incompleteReason: 'missing-input-schema' as const },
      false
    ]
  ] as const)('%s', ([, model, expected]) => {
    expect(canRunModel(model)).toBe(expected)
  })
})
