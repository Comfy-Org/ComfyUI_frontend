/**
 * What a settled billing operation may have changed, so the readers that
 * hold that state refetch it. `capabilities` alone follows a checkout that
 * was only started; `account` covers status, balance, and capabilities;
 * `subscription` reconciles a plan change on the checkout rail as well.
 */
export type BillingRefreshScope = 'capabilities' | 'account' | 'subscription'

type BillingRefreshListener = (
  scope: BillingRefreshScope
) => Promise<unknown> | void

const listeners = new Set<BillingRefreshListener>()

/**
 * Registers a reader of billing state. The rails and operation stores that
 * settle a mutation announce it through {@link refreshBilling} without
 * knowing which readers exist, so the readers can sit above them in the
 * import graph.
 */
export function onBillingRefresh(listener: BillingRefreshListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Resolves once every registered reader has settled its refetch. */
export async function refreshBilling(
  scope: BillingRefreshScope
): Promise<void> {
  await Promise.allSettled(Array.from(listeners, (listener) => listener(scope)))
}

/**
 * Reads the checkout rail's status and reports whether a pending operation
 * was adopted, so a caller watching for a payment taken in another tab can
 * stop watching.
 */
type CheckoutOperationReader = () => Promise<boolean>

const operationReaders = new Set<CheckoutOperationReader>()

/** Registers the reader that owns the checkout rail, same shape as {@link onBillingRefresh}. */
export function onCheckoutOperationRead(
  reader: CheckoutOperationReader
): () => void {
  operationReaders.add(reader)
  return () => {
    operationReaders.delete(reader)
  }
}

/** True once any registered reader adopted a pending checkout operation. */
export async function readCheckoutOperation(): Promise<boolean> {
  const results = await Promise.allSettled(
    Array.from(operationReaders, (reader) => reader())
  )
  return results.some((result) => result.status === 'fulfilled' && result.value)
}
