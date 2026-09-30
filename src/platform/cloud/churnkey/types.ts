export interface ChurnkeyHandlerResult {
  message?: string
}

export type ChurnkeySessionOutcome =
  | { type: 'discount-applied' }
  | { type: 'abandoned' }
  | { type: 'closed' }
  | { type: 'billing-pending' }
