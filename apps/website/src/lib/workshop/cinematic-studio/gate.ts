import type { WorkshopModelDetail } from '../../../config/models-catalogue'

export type StudioGate =
  | 'unavailable'
  | 'pending'
  | 'signedOut'
  | 'noCredits'
  | 'memberNoCredits'
  | 'ready'

export interface StudioGateInput {
  readonly runEnabled: boolean
  readonly modelRunnable: boolean
  readonly mounted: boolean
  readonly authAvailable: boolean
  readonly sessionSettled: boolean
  readonly role?: 'owner' | 'member'
  readonly outOfCredits: boolean
}

/**
 * What the Generate slot offers. `role` is present only once there is a
 * session; `sessionSettled` is false while a signed-in user's session is
 * still being minted.
 */
export function studioGate(input: StudioGateInput): StudioGate {
  if (!input.runEnabled || !input.modelRunnable) return 'unavailable'
  if (!input.mounted) return 'pending'
  if (!input.authAvailable) return 'unavailable'
  if (!input.sessionSettled) return 'pending'
  if (!input.role) return 'signedOut'
  if (!input.outOfCredits) return 'ready'
  return input.role === 'member' ? 'memberNoCredits' : 'noCredits'
}

export function canRunModel(
  model: Pick<WorkshopModelDetail, 'execution' | 'incompleteReason'>
): boolean {
  return !!model.execution && !model.incompleteReason
}
