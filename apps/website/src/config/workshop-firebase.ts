/**
 * The Workshop's Firebase surface: the package-owned identity entry bound
 * to the env-selected project, plus the sign-in actions composed with
 * customer provisioning. The sequencing rules (social always provisions a
 * customer; a failed provision during sign-up rolls the user back) live
 * tested in @comfyorg/account — this module only supplies the network
 * effects and wires them to the package identity.
 */
import type { User, UserCredential } from 'firebase/auth'

import { createFirebaseIdentity } from '@comfyorg/account/firebase'
import { socialSignInWithProvisioning } from '@comfyorg/account/provisioning'

import {
  WORKSHOP_FIREBASE_OPTIONS,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'

// Named app: never contend with a default app another script might create.
const WORKSHOP_APP_NAME = 'workshop'

/** Ceiling on the provisioning POST; a hung request must not strand sign-in. */
const WORKSHOP_PROVISION_TIMEOUT_MS = 15_000

const identity = createFirebaseIdentity({
  options: WORKSHOP_FIREBASE_OPTIONS,
  appName: WORKSHOP_APP_NAME
})

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

export async function provisionCustomer(
  user: ProvisionableUser,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<void> {
  const token = await user.getIdToken()
  const response = await fetchImpl(`${WORKSHOP_ROUTER_BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ signup_source: 'comfy-workshop' }),
    signal: AbortSignal.timeout(WORKSHOP_PROVISION_TIMEOUT_MS)
  })
  if (!isCustomerProvisioned(response.status, response.ok)) {
    throw new Error(`Customer provisioning failed: ${response.status}`)
  }
}

async function socialSignIn(
  signIn: () => Promise<UserCredential>
): Promise<UserCredential> {
  let credential: UserCredential | undefined
  try {
    return await socialSignInWithProvisioning({
      signIn: async () => {
        credential = await signIn()
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
  return socialSignIn(identity.signInWithGoogle)
}

export function signInWorkshopWithGitHub(): Promise<UserCredential> {
  return socialSignIn(identity.signInWithGitHub)
}

export function signOutWorkshop(): Promise<void> {
  return identity.signOut()
}

/** Fires with the restored user (or null) once Firebase settles, then on every change. */
export function onWorkshopUserChanged(
  callback: (user: User | null) => void
): () => void {
  return identity.onUserChanged(callback)
}
