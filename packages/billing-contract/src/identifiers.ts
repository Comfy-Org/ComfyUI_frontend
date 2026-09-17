/**
 * The charset every free-form identifier in the contract shares: plan slugs,
 * correlation ids, workspace ids, and the reference billing hands back. It is
 * deliberately narrower than what a URL permits, so nothing that survives it
 * can carry a path separator, a query delimiter, or a percent escape into a
 * downstream URL.
 */
const CONTRACT_IDENTIFIER = /^[A-Za-z0-9_-]{1,128}$/

export function isContractIdentifier(value: string): boolean {
  return CONTRACT_IDENTIFIER.test(value)
}
