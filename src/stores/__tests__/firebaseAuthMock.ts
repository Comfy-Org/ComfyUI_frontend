import type * as FirebaseAuth from 'firebase/auth'
import { vi } from 'vitest'

type ProviderMethods = Pick<
  FirebaseAuth.GoogleAuthProvider,
  'addScope' | 'setCustomParameters'
>

export const AuthErrorCodes = {
  NETWORK_REQUEST_FAILED: 'auth/network-request-failed',
  USER_DISABLED: 'auth/user-disabled'
} satisfies Pick<
  typeof FirebaseAuth.AuthErrorCodes,
  'NETWORK_REQUEST_FAILED' | 'USER_DISABLED'
>

export class GoogleAuthProvider implements ProviderMethods {
  addScope = vi.fn<ProviderMethods['addScope']>()
  setCustomParameters = vi.fn<ProviderMethods['setCustomParameters']>()
}

export class GithubAuthProvider implements ProviderMethods {
  addScope = vi.fn<ProviderMethods['addScope']>()
  setCustomParameters = vi.fn<ProviderMethods['setCustomParameters']>()
}

export const browserLocalPersistence = {}
export const createUserWithEmailAndPassword =
  vi.fn<typeof FirebaseAuth.createUserWithEmailAndPassword>()
export const getAdditionalUserInfo =
  vi.fn<typeof FirebaseAuth.getAdditionalUserInfo>()
export const onAuthStateChanged =
  vi.fn<typeof FirebaseAuth.onAuthStateChanged>()
export const onIdTokenChanged = vi.fn<typeof FirebaseAuth.onIdTokenChanged>()
export const setPersistence = vi.fn<typeof FirebaseAuth.setPersistence>()
export const signInWithEmailAndPassword =
  vi.fn<typeof FirebaseAuth.signInWithEmailAndPassword>()
export const signInWithPopup = vi.fn<typeof FirebaseAuth.signInWithPopup>()
export const signOut = vi.fn<typeof FirebaseAuth.signOut>()
