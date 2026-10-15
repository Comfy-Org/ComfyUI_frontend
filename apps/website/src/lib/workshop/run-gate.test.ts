import { describe, expect, it } from 'vitest'

import type { RunGate, RunGateInput } from './run-gate'
import { runGateFor } from './run-gate'

const ready: RunGateInput = {
  canRun: true,
  mounted: true,
  workshopEnabled: true,
  workshopSettled: true,
  draftPending: false,
  authAvailable: true,
  sessionSettled: true,
  role: 'owner',
  credits: 10
}

describe('runGateFor', () => {
  it.for<[string, Partial<RunGateInput>, RunGate]>([
    ['a model the page cannot run', { canRun: false }, 'unavailable'],
    ['before the page has mounted', { mounted: false }, 'resolving'],
    [
      'while the rollout flag is still answering',
      { workshopEnabled: false, workshopSettled: false },
      'resolving'
    ],
    [
      'once the rollout flag has answered no',
      { workshopEnabled: false },
      'rollingOut'
    ],
    ['while a saved draft is restoring', { draftPending: true }, 'pending'],
    ['when sign-in is unavailable', { authAvailable: false }, 'unavailable'],
    [
      'while the session is still minting',
      { sessionSettled: false },
      'pending'
    ],
    ['to a signed-out visitor', { role: undefined }, 'signedOut'],
    ['to an owner with an empty balance', { credits: 0 }, 'noCredits'],
    [
      'to a member with an empty balance',
      { role: 'member', credits: 0 },
      'memberNoCredits'
    ],
    ['while the balance is unknown', { credits: undefined }, 'ready'],
    ['to an owner with credits', {}, 'ready']
  ])('offers %s', ([, change, gate]) => {
    expect(runGateFor({ ...ready, ...change })).toBe(gate)
  })
})
