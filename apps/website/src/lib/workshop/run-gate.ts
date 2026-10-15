import type { StudioGate, StudioGateInput } from './cinematic-studio/gate'
import { studioGate } from './cinematic-studio/gate'

export type RunGate = StudioGate | 'resolving' | 'rollingOut'

export interface RunGateInput {
  readonly canRun: boolean
  readonly mounted: boolean
  readonly workshopEnabled: boolean
  readonly workshopSettled: boolean
  readonly draftPending: boolean
  readonly authAvailable: boolean
  readonly sessionSettled: boolean
  readonly role: StudioGateInput['role']
  readonly credits: StudioGateInput['credits']
}

/** What a model page's Run control offers, given where the visitor stands. */
export function runGateFor(input: RunGateInput): RunGate {
  if (!input.canRun) return 'unavailable'
  if (!input.mounted) return 'resolving'
  if (!input.workshopEnabled)
    return input.workshopSettled ? 'rollingOut' : 'resolving'
  if (input.draftPending) return 'pending'
  return studioGate({
    runEnabled: true,
    modelRunnable: true,
    mounted: true,
    authAvailable: input.authAvailable,
    sessionSettled: input.sessionSettled,
    role: input.role,
    credits: input.credits
  })
}
