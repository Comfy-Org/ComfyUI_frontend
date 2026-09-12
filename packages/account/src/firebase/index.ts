/**
 * The package-owned identity entry. Hosts either pass Firebase configuration
 * — including the persistence choice — for an app the package initializes,
 * or hand over the `Auth` they already hold, and get back the identity
 * surface the session core binds to plus the sign-in actions.
 *
 * Popup, never `signInWithRedirect`: the redirect flow is broken under
 * Safari's ITP for cross-origin helper domains, which is why the cloud app
 * is popup-only too. Provider scopes and the `select_account` prompt are the
 * cloud app's.
 *
 * This entry is the one place the package touches the Firebase SDK;
 * importGuard.test.ts holds `./core` to that boundary.
 */
import type { FirebaseOptions } from 'firebase/app'
import { getApps, initializeApp } from 'firebase/app'
import type { Auth, Persistence, User, UserCredential } from 'firebase/auth'
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword
} from 'firebase/auth'

import type { AccountIdentity } from '../core/identity.js'
import { identityBrand } from '../core/identity.js'
import { isFirebaseAuthErrorLike } from '../firebaseAuthError.js'

interface ActionCeiling {
  /**
   * Optional ceiling on email sign-in and password reset, which leave no
   * state behind when abandoned. None by default, as the cloud app runs
   * them. Never applied to account creation: a ceiling rejects the caller
   * while the SDK call may still succeed, leaving an orphaned account whose
   * every retry fails with email-already-in-use. Popup sign-in is never
   * bounded either; the SDK raises its own cancellation errors.
   */
  readonly actionTimeoutMs?: number
}

export interface FirebaseIdentityAppConfig extends ActionCeiling {
  readonly options: FirebaseOptions
  /** Named app: never contend with a default app another script creates. */
  readonly appName?: string
  /** Host-selected persistence; Firebase's default when omitted. */
  readonly persistence?: Persistence
}

/**
 * A host that already holds an `Auth` (the cloud app's vuefire instance)
 * binds the entry to it: no second app, no second persistence store.
 */
export interface FirebaseIdentityAuthConfig extends ActionCeiling {
  readonly auth: Auth
}

export type FirebaseIdentityConfig =
  | FirebaseIdentityAppConfig
  | FirebaseIdentityAuthConfig

export interface FirebaseIdentity extends AccountIdentity<User> {
  /**
   * Fires with the restored user (or null) once Firebase settles, then on
   * every change. This is the identity the session core binds to.
   */
  onUserChanged: (callback: (user: User | null) => void) => () => void
  signInWithGoogle: () => Promise<UserCredential>
  signInWithGitHub: () => Promise<UserCredential>
  signInWithEmail: (email: string, password: string) => Promise<UserCredential>
  createUserWithEmail: (
    email: string,
    password: string
  ) => Promise<UserCredential>
  sendPasswordReset: (email: string) => Promise<void>
  /** For the signed-in user; rejects when nobody is signed in. */
  updatePassword: (newPassword: string) => Promise<void>
  signOut: () => Promise<void>
}

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider()
  provider.addScope('email')
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

function githubProvider(): GithubAuthProvider {
  const provider = new GithubAuthProvider()
  provider.addScope('user:email')
  provider.setCustomParameters({ prompt: 'select_account' })
  return provider
}

function withCeiling<T>(run: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Firebase auth action timed out')),
      timeoutMs
    )
    run.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * An unknown email must look exactly like a sent reset, which is how Firebase
 * itself answers with email enumeration protection on; a distinct failure
 * here would be an account enumeration oracle.
 */
function resolveUnknownEmailAsSent(error: unknown): void {
  if (isFirebaseAuthErrorLike(error) && error.code === 'auth/user-not-found') {
    return
  }
  throw error
}

/**
 * Resolved once per identity. A named app this entry creates gets the
 * host's persistence through `initializeAuth`; an app another entry already
 * created keeps the persistence its creator chose, since Firebase allows one
 * Auth per app.
 */
function authResolver(config: FirebaseIdentityConfig): () => Auth {
  if ('auth' in config) return () => config.auth
  const appName = config.appName ?? 'comfy-account'
  let resolved: Auth | undefined
  return () => {
    if (resolved) return resolved
    const existing = getApps().find((app) => app.name === appName)
    if (existing) {
      resolved = getAuth(existing)
      return resolved
    }
    const app = initializeApp(config.options, appName)
    resolved = config.persistence
      ? initializeAuth(app, { persistence: config.persistence })
      : getAuth(app)
    return resolved
  }
}

export function createFirebaseIdentity(
  config: FirebaseIdentityConfig
): FirebaseIdentity {
  const { actionTimeoutMs } = config
  const auth = authResolver(config)
  const bounded = <T>(run: Promise<T>): Promise<T> =>
    actionTimeoutMs === undefined ? run : withCeiling(run, actionTimeoutMs)

  return {
    [identityBrand]: true,
    onUserChanged: (callback) => onAuthStateChanged(auth(), callback),
    signInWithGoogle: () => signInWithPopup(auth(), googleProvider()),
    signInWithGitHub: () => signInWithPopup(auth(), githubProvider()),
    signInWithEmail: (email, password) =>
      bounded(signInWithEmailAndPassword(auth(), email, password)),
    createUserWithEmail: (email, password) =>
      createUserWithEmailAndPassword(auth(), email, password),
    sendPasswordReset: (email) =>
      bounded(sendPasswordResetEmail(auth(), email)).catch(
        resolveUnknownEmailAsSent
      ),
    updatePassword: (newPassword) => {
      const user = auth().currentUser
      return user
        ? updatePassword(user, newPassword)
        : Promise.reject(
            new Error('No signed-in user to update the password for')
          )
    },
    signOut: () => signOut(auth())
  }
}
