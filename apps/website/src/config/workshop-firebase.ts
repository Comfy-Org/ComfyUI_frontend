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
import {
  CUSTOMER_PROVISIONING_PATH,
  customerProvisioningRequest,
  isCustomerProvisioned,
  socialSignInWithProvisioning
} from '@comfyorg/account/provisioning'

import {
  WORKSHOP_FIREBASE_OPTIONS,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'

// Named app: never contend with a default app another script might create.
const WORKSHOP_APP_NAME = 'workshop'

const identity = createFirebaseIdentity({
  options: WORKSHOP_FIREBASE_OPTIONS,
  appName: WORKSHOP_APP_NAME
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

export async function provisionCustomer(
  user: ProvisionableUser,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<void> {
  const token = await user.getIdToken()
  const response = await fetchImpl(
    `${WORKSHOP_ROUTER_BASE_URL}${CUSTOMER_PROVISIONING_PATH}`,
    customerProvisioningRequest({
      authHeaders: { Authorization: `Bearer ${token}` },
      signupSource: 'comfy-workshop'
    })
  )
  if (!isCustomerProvisioned(response)) {
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
