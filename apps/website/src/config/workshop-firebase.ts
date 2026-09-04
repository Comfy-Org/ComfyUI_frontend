/**
 * The Workshop's Firebase surface: one lazily-created auth instance bound to
 * the env-selected project, plus the sign-in actions. The sequencing rules
 * (social always provisions a customer; a failed provision during sign-up
 * rolls the user back) live tested in @comfyorg/auth-core — this module only
 * supplies the Firebase and network effects.
 *
 * Firebase is imported dynamically so pages that merely COULD sign in (every
 * model page reads the credential seam) ship none of it until the auth flag
 * is on and something here actually runs.
 *
 * Popup, never `signInWithRedirect`: the redirect flow is broken under
 * Safari's ITP for cross-origin helper domains, which is why the platform
 * app is popup-only too.
 */
import type { Auth, User, UserCredential } from 'firebase/auth'

import {
  signUpWithProvisioning,
  socialSignInWithProvisioning
} from '@comfyorg/auth-core/provisioning'

import {
  WORKSHOP_FIREBASE_OPTIONS,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'

// Named app: never contend with a default app another script might create.
const WORKSHOP_APP_NAME = 'workshop'

/** Ceiling on the provisioning POST; a hung request must not strand sign-in. */
export const WORKSHOP_PROVISION_TIMEOUT_MS = 15_000

async function workshopAuth(): Promise<Auth> {
  const [{ getApps, initializeApp }, { getAuth }] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth')
  ])
  const existing = getApps().find((app) => app.name === WORKSHOP_APP_NAME)
  return getAuth(
    existing ?? initializeApp(WORKSHOP_FIREBASE_OPTIONS, WORKSHOP_APP_NAME)
  )
}

/**
 * Pre-resolves the Firebase chunks so the popup call inside a click handler
 * doesn't spend its user-gesture budget on module loading.
 */
export async function warmWorkshopAuth(): Promise<void> {
  await workshopAuth()
}

/**
 * Whether a `POST /customers` response means the customer is provisioned. A
 * 409 counts as success: the record already exists, which is the norm when a
 * social user signs in again.
 */
export function isCustomerProvisioned(status: number, ok: boolean): boolean {
  return ok || status === 409
}

/** The slice of a Firebase user this call needs; injectable in tests. */
interface ProvisionableUser {
  getIdToken: () => Promise<string>
}

export async function provisionCustomer(
  user: ProvisionableUser,
  turnstileToken?: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<void> {
  const token = await user.getIdToken()
  const response = await fetchImpl(`${WORKSHOP_ROUTER_BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      signup_source: 'comfy-workshop',
      ...(turnstileToken ? { turnstile_token: turnstileToken } : {})
    }),
    signal: AbortSignal.timeout(WORKSHOP_PROVISION_TIMEOUT_MS)
  })
  if (!isCustomerProvisioned(response.status, response.ok)) {
    throw new Error(`Customer provisioning failed: ${response.status}`)
  }
}

async function signInWithProvider(
  provider: 'google' | 'github'
): Promise<UserCredential> {
  const [auth, { GithubAuthProvider, GoogleAuthProvider, signInWithPopup }] =
    await Promise.all([workshopAuth(), import('firebase/auth')])
  return socialSignInWithProvisioning({
    signIn: () =>
      signInWithPopup(
        auth,
        provider === 'google'
          ? new GoogleAuthProvider()
          : new GithubAuthProvider()
      ),
    provisionCustomer: (credential) => provisionCustomer(credential.user)
  })
}

export function signInWorkshopWithGoogle(): Promise<UserCredential> {
  return signInWithProvider('google')
}

export function signInWorkshopWithGitHub(): Promise<UserCredential> {
  return signInWithProvider('github')
}

export async function signInWorkshopWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const [auth, { signInWithEmailAndPassword }] = await Promise.all([
    workshopAuth(),
    import('firebase/auth')
  ])
  // Sign-in provisions too, mirroring the platform app: an account created
  // elsewhere may reach billing surfaces here first.
  return socialSignInWithProvisioning({
    signIn: () => signInWithEmailAndPassword(auth, email, password),
    provisionCustomer: (credential) => provisionCustomer(credential.user)
  })
}

/**
 * Creation and provisioning as one sequence: the tested auth-core rollback
 * deletes the just-created Firebase user when provisioning fails, so a
 * rejected Turnstile token can never orphan an account that then bricks
 * every retry with email-already-in-use.
 */
export async function signUpWorkshopWithEmail(
  email: string,
  password: string,
  turnstileToken?: string
): Promise<UserCredential> {
  const [auth, { createUserWithEmailAndPassword }] = await Promise.all([
    workshopAuth(),
    import('firebase/auth')
  ])
  return signUpWithProvisioning({
    createUser: () => createUserWithEmailAndPassword(auth, email, password),
    provisionCustomer: (credential) =>
      provisionCustomer(credential.user, turnstileToken),
    onRollbackFailure: (error) => {
      console.warn(
        'Failed to roll back orphaned Firebase user after customer creation failed',
        error
      )
    }
  })
}

export async function sendWorkshopPasswordReset(email: string): Promise<void> {
  const [auth, { sendPasswordResetEmail }] = await Promise.all([
    workshopAuth(),
    import('firebase/auth')
  ])
  return sendPasswordResetEmail(auth, email)
}

export async function signOutWorkshop(): Promise<void> {
  const [auth, { signOut }] = await Promise.all([
    workshopAuth(),
    import('firebase/auth')
  ])
  return signOut(auth)
}

/** Fires with the restored user (or null) once Firebase settles, then on every change. */
export function onWorkshopUserChanged(
  callback: (user: User | null) => void
): () => void {
  let unsubscribe: (() => void) | undefined
  let cancelled = false
  void (async () => {
    try {
      const [auth, { onAuthStateChanged }] = await Promise.all([
        workshopAuth(),
        import('firebase/auth')
      ])
      if (cancelled) return
      unsubscribe = onAuthStateChanged(auth, callback)
    } catch (error) {
      // A Firebase chunk that fails to load leaves the visitor signed out
      // rather than crashing an unhandled rejection.
      console.error('Workshop auth listener failed to attach', error)
      if (!cancelled) callback(null)
    }
  })()
  return () => {
    cancelled = true
    unsubscribe?.()
  }
}
