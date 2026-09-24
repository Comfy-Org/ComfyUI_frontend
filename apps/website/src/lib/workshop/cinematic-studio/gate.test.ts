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
  outOfCredits: false
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
    ['asks an owner to buy credits', { outOfCredits: true }, 'noCredits'],
    [
      'tells a member the workspace is out',
      { outOfCredits: true, role: 'member' },
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
