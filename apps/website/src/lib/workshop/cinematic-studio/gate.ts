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
  /** The balance, once read. */
  readonly credits?: number
  /** The least the shot is estimated to cost, when its model is priced. */
  readonly cost?: number
}

/**
 * Whether a balance covers a run. Without an estimate only an empty balance
 * is known to be short; with one, anything below it is.
 */
function coversCost(
  credits: number | undefined,
  cost: number | undefined
): boolean {
  if (credits === undefined) return true
  return cost === undefined ? credits > 0 : credits >= cost
}

/**
 * What the Generate slot offers. `role` is present only once there is a
 * session; `sessionSettled` is false while a signed-in user's session is
 * still being minted. Sign-in is asked before anything the account could fix.
 */
export function studioGate(input: StudioGateInput): StudioGate {
  if (!input.runEnabled || !input.modelRunnable) return 'unavailable'
  if (!input.mounted) return 'pending'
  if (!input.authAvailable) return 'unavailable'
  if (!input.sessionSettled) return 'pending'
  if (!input.role) return 'signedOut'
  if (coversCost(input.credits, input.cost)) return 'ready'
  return input.role === 'member' ? 'memberNoCredits' : 'noCredits'
}

export function canRunModel(
  model: Pick<WorkshopModelDetail, 'execution' | 'incompleteReason'>
): boolean {
  return !!model.execution && !model.incompleteReason
}
