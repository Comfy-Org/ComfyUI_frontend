import type * as FirebaseAuth from 'firebase/auth'
import { vi } from 'vitest'

type ProviderMethods = Pick<
  FirebaseAuth.GoogleAuthProvider,
  'addScope' | 'setCustomParameters'
>

export const AuthErrorCodes = {
  CREDENTIAL_TOO_OLD_LOGIN_AGAIN: 'auth/requires-recent-login',
  EXPIRED_POPUP_REQUEST: 'auth/cancelled-popup-request',
  NETWORK_REQUEST_FAILED: 'auth/network-request-failed',
  POPUP_BLOCKED: 'auth/popup-blocked',
  POPUP_CLOSED_BY_USER: 'auth/popup-closed-by-user',
  USER_DISABLED: 'auth/user-disabled'
} satisfies Pick<
  typeof FirebaseAuth.AuthErrorCodes,
  | 'CREDENTIAL_TOO_OLD_LOGIN_AGAIN'
  | 'EXPIRED_POPUP_REQUEST'
  | 'NETWORK_REQUEST_FAILED'
  | 'POPUP_BLOCKED'
  | 'POPUP_CLOSED_BY_USER'
  | 'USER_DISABLED'
>

export class GoogleAuthProvider implements ProviderMethods {
  addScope = vi.fn<ProviderMethods['addScope']>()
  setCustomParameters = vi.fn<ProviderMethods['setCustomParameters']>()
}

export class GithubAuthProvider implements ProviderMethods {
  addScope = vi.fn<ProviderMethods['addScope']>()
  setCustomParameters = vi.fn<ProviderMethods['setCustomParameters']>()
}

export const browserLocalPersistence = {
  type: 'LOCAL'
} satisfies FirebaseAuth.Persistence
export const browserSessionPersistence = {
  type: 'SESSION'
} satisfies FirebaseAuth.Persistence
export const indexedDBLocalPersistence = {
  type: 'LOCAL'
} satisfies FirebaseAuth.Persistence
export const browserPopupRedirectResolver =
  {} satisfies FirebaseAuth.PopupRedirectResolver
export const createUserWithEmailAndPassword =
  vi.fn<typeof FirebaseAuth.createUserWithEmailAndPassword>()
export const getAdditionalUserInfo =
  vi.fn<typeof FirebaseAuth.getAdditionalUserInfo>()
export const getAuth = vi.fn<typeof FirebaseAuth.getAuth>()
export const initializeAuth = vi.fn<typeof FirebaseAuth.initializeAuth>()
export const onAuthStateChanged =
  vi.fn<typeof FirebaseAuth.onAuthStateChanged>()
export const onIdTokenChanged = vi.fn<typeof FirebaseAuth.onIdTokenChanged>()
export const sendPasswordResetEmail =
  vi.fn<typeof FirebaseAuth.sendPasswordResetEmail>()
export const signInWithEmailAndPassword =
  vi.fn<typeof FirebaseAuth.signInWithEmailAndPassword>()
export const signInWithPopup = vi.fn<typeof FirebaseAuth.signInWithPopup>()
export const signOut = vi.fn<typeof FirebaseAuth.signOut>()
export const updatePassword = vi.fn<typeof FirebaseAuth.updatePassword>()
