type ApprovalOutcome =
  | 'approved'
  | 'denied'
  | 'timeout'
  | 'cancelled'
  | 'disconnected'

// waiting = user answered but the server's terminal outcome has not landed yet.
type ApprovalCardStatus = 'open' | 'waiting' | 'resolved'

export interface ApprovalCard {
  approvalId: string
  turnId: string
  tool: string
  summary: string
  status: ApprovalCardStatus
  outcome: ApprovalOutcome | null
}

export type LockState =
  | 'UNLOCKED'
  | 'LOCK_PENDING'
  | 'LOCKED'
  | 'CONFLICT'
  | 'UNLOCKING'

// 'cancel' defers the decision (the next turn re-asks); the other three act on
// the pending draft, per DES-502.
export type ConflictChoice = 'agent' | 'mine' | 'newtab' | 'cancel'
