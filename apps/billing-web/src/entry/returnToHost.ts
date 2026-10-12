/**
 * The way back to the product. The product opens billing in a tab of its own
 * (`openHostedBillingTab`), which leaves the product's tab where it was, so
 * going back means closing this tab: a tab opened by script may close
 * itself, `noopener` or not. A tab the customer opened directly cannot, and
 * `closed` stays false, so it goes to the product's URL instead.
 */
export function returnToHost(href: string): void {
  window.close()
  if (!window.closed) window.location.assign(href)
}
