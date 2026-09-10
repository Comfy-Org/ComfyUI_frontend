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
  customerProvisioningRequest
} from '@comfyorg/account/provisioning'

import {
  WORKSHOP_FIREBASE_OPTIONS,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'

// Named app: never contend with a default app another script might create.
const WORKSHOP_APP_NAME = 'workshop'
/** Ceiling on the provisioning POST; a hung request must not strand sign-in. */
const PROVISIONING_TIMEOUT_MS = 15_000

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
      signupSource: 'comfy-workshop',
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

/** Whether the popup created the account, the way the cloud app reports it. */
export function isNewWorkshopUser(credential: UserCredential): boolean {
  return getAdditionalUserInfo(credential)?.isNewUser ?? false
}

export function signOutWorkshop(): Promise<void> {
  return identity.signOut()
}

/** Fires with the restored user (or null) once Firebase settles, then on every change. */
/** The identity the session client attaches; only the package can mint one. */
export const workshopIdentity = identity
