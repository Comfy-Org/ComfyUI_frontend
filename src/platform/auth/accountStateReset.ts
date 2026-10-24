interface AccountStateResetContext {
  readonly signedIn: boolean
}

type AccountStateReset = (context: AccountStateResetContext) => void

const resets = new Map<string, AccountStateReset>()

/** Registers how the store `id` drops the previous account's state; the latest registration wins. */
export function onAccountIdentityChange(
  id: string,
  reset: AccountStateReset
): () => void {
  resets.set(id, reset)
  return () => {
    if (resets.get(id) === reset) resets.delete(id)
  }
}

/** Called by `authStore` when the signed-in identity changes or signs out. */
export function resetAccountScopedState(
  context: AccountStateResetContext
): void {
  for (const reset of resets.values()) reset(context)
}
