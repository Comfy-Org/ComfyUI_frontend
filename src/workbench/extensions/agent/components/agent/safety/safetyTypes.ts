// The M5 safety surfaces are SHELVED for comfy-agent v1: the server owns mutation and
// concurrency, and no approval/lock wire exists. These types keep the kept-but-unwired
// safety components compiling until a future approval channel revives them. Ids are plain
// string here (the branded ApprovalId/RpcId namespaces died with the old chat schema).

// The server's authoritative approval outcomes. 'approved' is the only non-drop outcome.
type ApprovalOutcome =
  | 'approved'
  | 'denied'
  | 'timeout'
  | 'cancelled'
  | 'disconnected'

// open    - awaiting the user's click; buttons live.
// waiting - the user answered, buttons disabled; NOT resolved.
// resolved - the server's terminal outcome landed.
type ApprovalCardStatus = 'open' | 'waiting' | 'resolved'

export interface ApprovalCard {
  approvalId: string
  turnId: string
  tool: string
  summary: string
  status: ApprovalCardStatus
  // Set only once status is 'resolved'; the terminal server outcome.
  outcome: ApprovalOutcome | null
}

export type LockState =
  | 'UNLOCKED'
  | 'LOCK_PENDING'
  | 'LOCKED'
  | 'CONFLICT'
  | 'UNLOCKING'

export type ConflictChoice = 'agent' | 'mine' | 'newtab'
