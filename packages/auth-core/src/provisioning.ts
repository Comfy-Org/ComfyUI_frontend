/**
 * The account-creation sequences both hosts must agree on, with the effects
 * injected so the invariants live (and are tested) exactly once. Mirrors the
 * platform app's `authStore.register` / `loginWithGoogle` semantics.
 */

interface DeletableUserCredential {
  user: { delete: () => Promise<void> }
}

/**
 * Email sign-up: create the Firebase user, then provision the Comfy customer.
 *
 * Provisioning is where a Turnstile token gets validated server-side; if it
 * fails (rejection, 5xx, network) the Firebase user is already created and,
 * without rollback, the account is orphaned — every retry then fails
 * "email already in use", permanently bricking signup. So a provisioning
 * failure deletes the just-created user (best-effort: a cleanup failure never
 * masks the original error) and rethrows.
 */
export async function signUpWithProvisioning<
  T extends DeletableUserCredential
>(deps: {
  createUser: () => Promise<T>
  provisionCustomer: (credential: T) => Promise<unknown>
  onRollbackFailure?: (error: unknown) => void
}): Promise<T> {
  const credential = await deps.createUser()
  try {
    await deps.provisionCustomer(credential)
  } catch (error) {
    try {
      await credential.user.delete()
    } catch (rollbackError) {
      // A reporting sink can throw; never let it displace the original error.
      try {
        deps.onRollbackFailure?.(rollbackError)
      } catch {
        void 0
      }
    }
    throw error
  }
  return credential
}

/**
 * Social sign-in: the popup, then find-or-create the Comfy customer — always,
 * because a social user's first touch may be this host and skipping the
 * customer record produces accounts where billing surfaces fail.
 * `provisionCustomer` must tolerate an already-provisioned account. No
 * rollback here: the signed-in user may be a long-standing account, and
 * deleting it over a provisioning hiccup would destroy it — a provisioning
 * failure propagates with the user still signed in.
 */
export async function socialSignInWithProvisioning<T>(deps: {
  signIn: () => Promise<T>
  provisionCustomer: (credential: T) => Promise<unknown>
}): Promise<T> {
  const credential = await deps.signIn()
  await deps.provisionCustomer(credential)
  return credential
}
