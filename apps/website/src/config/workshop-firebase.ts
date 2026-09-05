/**
 * The Workshop's Firebase surface: one lazily-created auth instance bound to
 * the env-selected project, plus the sign-in actions. The sequencing rules
 * (social always provisions a customer; a failed provision during sign-up
 * rolls the user back) live tested in @comfyorg/auth-core — this module only
 * supplies the Firebase and network effects.
 *
 * Popup, never `signInWithRedirect`: the redirect flow is broken under
 * Safari's ITP for cross-origin helper domains, which is why the platform
 * app is popup-only too.
 */
import { getApps, initializeApp } from 'firebase/app'
import type { User, UserCredential } from 'firebase/auth'
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth'

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
const WORKSHOP_PROVISION_TIMEOUT_MS = 15_000

function workshopAuth() {
  const existing = getApps().find((app) => app.name === WORKSHOP_APP_NAME)
  return getAuth(
    existing ?? initializeApp(WORKSHOP_FIREBASE_OPTIONS, WORKSHOP_APP_NAME)
  )
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

export class WorkshopProvisioningError extends Error {
  constructor(
    readonly user: User,
    options: ErrorOptions
  ) {
    super('Signed in, but customer provisioning failed', options)
    this.name = 'WorkshopProvisioningError'
  }
}

export function isWorkshopProvisioningError(
  error: unknown
): error is WorkshopProvisioningError {
  return error instanceof WorkshopProvisioningError
}

interface ProvisionCustomerOptions {
  readonly turnstileToken?: string
  readonly fetchImpl?: typeof fetch
}

export async function provisionCustomer(
  user: ProvisionableUser,
  options: ProvisionCustomerOptions = {}
): Promise<void> {
  const { turnstileToken, fetchImpl = globalThis.fetch } = options
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

async function socialSignIn(
  provider: GoogleAuthProvider | GithubAuthProvider
): Promise<UserCredential> {
  let credential: UserCredential | undefined
  try {
    return await socialSignInWithProvisioning({
      signIn: async () => {
        credential = await signInWithPopup(workshopAuth(), provider)
        return credential
      },
      provisionCustomer: (result) => provisionCustomer(result.user)
    })
  } catch (cause) {
    if (credential) {
      throw new WorkshopProvisioningError(credential.user, { cause })
    }
    throw cause
  }
}

export function signInWorkshopWithGoogle(): Promise<UserCredential> {
  return socialSignIn(new GoogleAuthProvider())
}

export function signInWorkshopWithGitHub(): Promise<UserCredential> {
  return socialSignIn(new GithubAuthProvider())
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
      provisionCustomer(credential.user, { turnstileToken }),
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
  return onAuthStateChanged(workshopAuth(), callback)
}
