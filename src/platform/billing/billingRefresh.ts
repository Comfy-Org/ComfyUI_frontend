/**
 * What a settled billing operation may have changed in the billing context:
 * `account` refetches status and balance; `subscription` reconciles a plan
 * change on the checkout rail as well.
 */
export type BillingRefreshScope = 'account' | 'subscription'

type BillingRefreshListener = (
  scope: BillingRefreshScope
) => Promise<unknown> | void

type CheckoutOperationReader = () => Promise<boolean>

const listeners = new Set<BillingRefreshListener>()
let checkoutOperationReader: CheckoutOperationReader | undefined

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

/** Starts every registered reader's refetch; settles once they all have. */
export function refreshBilling(scope: BillingRefreshScope): Promise<unknown> {
  return Promise.allSettled(
    Array.from(listeners, (listener) => listener(scope))
  )
}

/**
 * Registers the billing context's checkout-operation read, which knows the
 * rail that serves the checkout. Only one context exists at a time.
 */
export function provideCheckoutOperationReader(
  reader: CheckoutOperationReader
): () => void {
  checkoutOperationReader = reader
  return () => {
    if (checkoutOperationReader === reader) checkoutOperationReader = undefined
  }
}

/**
 * Reads the checkout rail's status, which resumes any operation the server
 * reports pending. True once that operation was adopted; false while no
 * billing context is registered.
 */
export async function readCheckoutOperation(): Promise<boolean> {
  return (await checkoutOperationReader?.()) ?? false
}
