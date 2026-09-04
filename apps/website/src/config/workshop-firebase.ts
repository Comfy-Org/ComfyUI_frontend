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
  signInWithPopup,
  signOut
} from 'firebase/auth'

import { socialSignInWithProvisioning } from '@comfyorg/auth-core/provisioning'

import {
  WORKSHOP_FIREBASE_OPTIONS,
  WORKSHOP_ROUTER_BASE_URL
} from './workshop-env'

// Named app: never contend with a default app another script might create.
const WORKSHOP_APP_NAME = 'workshop'

function workshopAuth() {
  const existing = getApps().find((app) => app.name === WORKSHOP_APP_NAME)
  return getAuth(
    existing ?? initializeApp(WORKSHOP_FIREBASE_OPTIONS, WORKSHOP_APP_NAME)
  )
}

/**
 * Find-or-create the Comfy customer record for a signed-in user. A 409 means
 * the customer already exists, which is success for this call — social users
 * routinely sign in again.
 */
async function provisionCustomer(user: User): Promise<void> {
  const token = await user.getIdToken()
  const response = await fetch(`${WORKSHOP_ROUTER_BASE_URL}/customers`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ signup_source: 'comfy-workshop' })
  })
  if (!response.ok && response.status !== 409) {
    throw new Error(`Customer provisioning failed: ${response.status}`)
  }
}

export function signInWorkshopWithGoogle(): Promise<UserCredential> {
  return socialSignInWithProvisioning({
    signIn: () => signInWithPopup(workshopAuth(), new GoogleAuthProvider()),
    provisionCustomer: (credential) => provisionCustomer(credential.user)
  })
}

export function signInWorkshopWithGitHub(): Promise<UserCredential> {
  return socialSignInWithProvisioning({
    signIn: () => signInWithPopup(workshopAuth(), new GithubAuthProvider()),
    provisionCustomer: (credential) => provisionCustomer(credential.user)
  })
}

export function signOutWorkshop(): Promise<void> {
  return signOut(workshopAuth())
}

/** Fires with the restored user (or null) once Firebase settles, then on every change. */
export function onWorkshopUserChanged(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(workshopAuth(), callback)
}
