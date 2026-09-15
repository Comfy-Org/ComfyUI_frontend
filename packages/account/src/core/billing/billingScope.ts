import type { BillingSession } from './billingContracts.js'
import type { AccountCredential } from '../sessionContracts.js'

export interface BillingScope {
  readonly userId: string
  readonly workspaceId: string
  readonly role: AccountCredential['role']
}

export interface BillingScopeContext {
  readonly scope: BillingScope
  readonly generation: number
}

export interface BillingScopeTracker {
  capture: () => BillingScopeContext | undefined
  isCurrent: (context: BillingScopeContext) => boolean
  dispose: () => void
}

export function sameBillingScope(a: BillingScope, b: BillingScope): boolean {
  return (
    a.userId === b.userId &&
    a.workspaceId === b.workspaceId &&
    a.role === b.role
  )
}

export function createBillingScopeTracker(
  session: BillingSession,
  onChange: () => void
): BillingScopeTracker {
  let scope = readBillingScope(session)
  let generation = 0

  const unsubscribe = session.subscribe(() => {
    const next = readBillingScope(session)
    if (
      (scope === undefined && next === undefined) ||
      (scope !== undefined &&
        next !== undefined &&
        sameBillingScope(scope, next))
    ) {
      return
    }

    scope = next
    generation++
    onChange()
  })

  return {
    capture: () => (scope === undefined ? undefined : { scope, generation }),
    isCurrent: (context) =>
      context.generation === generation &&
      scope !== undefined &&
      sameBillingScope(context.scope, scope),
    dispose: unsubscribe
  }
}

function readBillingScope(session: BillingSession): BillingScope | undefined {
  const state = session.getSnapshot()
  if (state.user === null || state.session === undefined) return undefined
  return {
    userId: state.user.uid,
    workspaceId: state.session.workspace.id,
    role: state.session.role
  }
}
