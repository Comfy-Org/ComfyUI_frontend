/**
 * The Workshop's Firebase surface: the package-owned identity entry bound
 * to the env-selected project, plus sign-in and customer provisioning as
 * separate steps so the consumer can gate provisioning on the rollout flag.
 * This module only supplies the network effects and wires them to the
 * package identity.
 */
import type { User, UserCredential } from 'firebase/auth'
import { getAdditionalUserInfo } from 'firebase/auth'

import { createFirebaseIdentity } from '@comfyorg/account/firebase'
import {
  CUSTOMER_PROVISIONING_PATH,
  customerProvisioningRequest,
  signUpWithProvisioning
} from '@comfyorg/account/provisioning'

import { captureSignupRollbackFailure } from '../scripts/posthog'
import {
  WORKSHOP_FIREBASE_OPTIONS,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'

// Named app: never contend with a default app another script might create.
const WORKSHOP_APP_NAME = 'workshop'
/** Ceiling on the provisioning POST; a hung request must not strand sign-in. */
const PROVISIONING_TIMEOUT_MS = 15_000
/** Bounds email sign-in and password reset so a stalled request never pins the
 *  form busy; popup and account creation stay unbounded by the package. */
const FIREBASE_ACTION_TIMEOUT_MS = 15_000

const identity = createFirebaseIdentity({
  options: WORKSHOP_FIREBASE_OPTIONS,
  appName: WORKSHOP_APP_NAME,
  actionTimeoutMs: FIREBASE_ACTION_TIMEOUT_MS
})

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
  const response = await fetchImpl(
    `${WORKSHOP_ROUTER_BASE_URL}${CUSTOMER_PROVISIONING_PATH}`,
    customerProvisioningRequest({
      authHeaders: { Authorization: `Bearer ${token}` },
      signupSource: 'comfy-workshop',
      turnstileToken,
      signal: AbortSignal.timeout(PROVISIONING_TIMEOUT_MS)
    })
  )
  if (!response.ok) {
    throw new Error(`Customer provisioning failed: ${response.status}`)
  }
}

export function signInWorkshopWithGoogle(): Promise<UserCredential> {
  return identity.signInWithGoogle()
}

export function signInWorkshopWithGitHub(): Promise<UserCredential> {
  return identity.signInWithGitHub()
}

// Split from sign-in so the consumer can gate it: disabling the rollout during
// the popup must be able to stop provisioning before it fires.
export async function provisionWorkshopCustomer(
  credential: UserCredential
): Promise<void> {
  try {
    await provisionCustomer(credential.user)
  } catch (cause) {
    throw new WorkshopProvisioningError(credential.user, { cause })
  }
}

/** Whether the credential created the account, the way the cloud app reports it. */
export function isNewWorkshopUser(credential: UserCredential): boolean {
  return getAdditionalUserInfo(credential)?.isNewUser ?? false
}

export function signInWorkshopWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return identity.signInWithEmail(email, password)
}

/**
 * Creation and provisioning as one sequence: a provisioning failure (e.g. a
 * rejected Turnstile token) deletes the just-created Firebase user, with one
 * retried delete, so a single blip cannot orphan an account that then bricks
 * every retry with email-already-in-use. A double delete failure still
 * orphans; the rollback hook is the signal for that case.
 */
export function signUpWorkshopWithEmail(
  email: string,
  password: string,
  turnstileToken?: string
): Promise<UserCredential> {
  return signUpWithProvisioning({
    createUser: () => identity.createUserWithEmail(email, password),
    provisionCustomer: (credential) =>
      provisionCustomer(credential.user, { turnstileToken }),
    onRollbackFailure: (error) => {
      captureSignupRollbackFailure()
      console.warn(
        'Failed to roll back orphaned Firebase user after customer creation failed',
        error
      )
    }
  })
}

export function sendWorkshopPasswordReset(email: string): Promise<void> {
  return identity.sendPasswordReset(email)
}

export function signOutWorkshop(): Promise<void> {
  return identity.signOut()
}

/** Fires with the restored user (or null) once Firebase settles, then on every change. */
/** The identity the session client attaches; only the package can mint one. */
export const workshopIdentity = identity
