import type { OperationOutcomeRead } from '@comfyorg/account-core/billing'
import { OPERATION_POLL_BUDGET } from '@comfyorg/account-core/billing'

/** A tab that ended on an unsettled payment and can still read how it ends. */
export interface CheckingPayment {
  readonly kind: 'ended'
  readonly ending: 'payment_pending'
  /** The operation still settling when the session ended. */
  readonly reference: string
  /** The workspace that payment is for. */
  readonly workspace: string
  /** The ended session's bearer, kept to read that operation's outcome and for nothing else. */
  readonly token: string
}

type OutcomeEnding =
  | {
      readonly kind: 'ended'
      readonly ending: 'completed'
      readonly workspace: string
      readonly reference: string
    }
  | {
      readonly kind: 'ended'
      readonly ending: 'unconfirmed'
      readonly reference: string
    }

const CHECKING_BUDGET_MS = OPERATION_POLL_BUDGET.subscriptionDiscoveryMs

function unconfirmed({ reference }: CheckingPayment): OutcomeEnding {
  return { kind: 'ended', ending: 'unconfirmed', reference }
}

type SettledOutcome = Exclude<
  Extract<OperationOutcomeRead, { kind: 'outcome' }>['status'],
  'pending'
>

const ENDING_OF: Record<
  SettledOutcome,
  (checking: CheckingPayment) => OutcomeEnding
> = {
  succeeded: ({ reference, workspace }) => ({
    kind: 'ended',
    ending: 'completed',
    workspace,
    reference
  }),
  failed: unconfirmed,
  reconciliation_needed: unconfirmed
}

/** Where a checking tab stands after one outcome read: the same state while it should read again. */
export function afterOutcomeRead(
  checking: CheckingPayment,
  read: OperationOutcomeRead,
  waitedMs: number
): CheckingPayment | OutcomeEnding {
  if (read.kind === 'refused') return unconfirmed(checking)
  if (read.kind === 'outcome' && read.status !== 'pending')
    return ENDING_OF[read.status](checking)
  return waitedMs < CHECKING_BUDGET_MS ? checking : unconfirmed(checking)
}
