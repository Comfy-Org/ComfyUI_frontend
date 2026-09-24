export type StudioGate =
  | 'unavailable'
  | 'pending'
  | 'signedOut'
  | 'noCredits'
  | 'memberNoCredits'
  | 'ready'

export interface StudioGateInput {
  readonly runEnabled: boolean
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
  if (!input.runEnabled) return 'unavailable'
  if (!input.mounted) return 'pending'
  if (!input.authAvailable) return 'unavailable'
  if (!input.sessionSettled) return 'pending'
  if (!input.role) return 'signedOut'
  if (!input.outOfCredits) return 'ready'
  return input.role === 'member' ? 'memberNoCredits' : 'noCredits'
}
