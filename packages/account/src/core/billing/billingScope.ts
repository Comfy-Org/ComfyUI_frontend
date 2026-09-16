/**
 * The scope port: the one thing the billing core needs to know about the
 * identity it runs as — which user, which workspace, which role — and when
 * that changes. A host that holds a browser session client adapts it with
 * `sessionBillingScopeSource`; a host whose credentials live on its own
 * server reads the scope out of its bootstrap payload instead, and never
 * hands the core a session client it does not have.
 */
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

/**
 * Where the core learns its scope. `getScope` is undefined whenever no scope
 * is established — signed out, or not settled yet — and `subscribe` reports
 * that anything about it may have changed.
 */
export interface BillingScopeSource {
  readonly getScope: () => BillingScope | undefined
  readonly subscribe: (listener: () => void) => () => void
}

export function sameBillingScope(a: BillingScope, b: BillingScope): boolean {
  return (
    a.userId === b.userId &&
    a.workspaceId === b.workspaceId &&
    a.role === b.role
  )
}

type BillingScopeSession = Pick<BillingSession, 'getSnapshot' | 'subscribe'>

/** The scope a workspace session client is currently minted for. */
export function sessionBillingScopeSource(
  session: BillingScopeSession
): BillingScopeSource {
  return {
    getScope: () => readSessionScope(session),
    subscribe: (listener) => session.subscribe(listener)
  }
}

export function createBillingScopeTracker(
  source: BillingScopeSource,
  onChange: () => void
): BillingScopeTracker {
  let scope = source.getScope()
  let generation = 0

  const unsubscribe = source.subscribe(() => {
    const next = source.getScope()
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

function readSessionScope(
  session: BillingScopeSession
): BillingScope | undefined {
  const state = session.getSnapshot()
  if (state.user === null || state.session === undefined) return undefined
  return {
    userId: state.user.uid,
    workspaceId: state.session.workspace.id,
    role: state.session.role
  }
}
