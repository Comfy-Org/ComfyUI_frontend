export type PrCheckoutAction =
  | 'already-on-branch'
  | 'refuse-dirty'
  | 'offer-switch'

export function decidePrCheckout(
  currentBranch: string,
  prBranch: string,
  dirty: boolean
): PrCheckoutAction {
  if (currentBranch === prBranch) return 'already-on-branch'
  if (dirty) return 'refuse-dirty'
  return 'offer-switch'
}
