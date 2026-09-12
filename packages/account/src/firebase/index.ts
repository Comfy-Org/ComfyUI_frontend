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
  /** A host-owned `Auth` and package-owned app options are exclusive. */
  readonly auth?: never
}

/**
 * A host that already holds an `Auth` (the cloud app's vuefire instance)
 * binds the entry to it: no second app, no second persistence store.
 */
export interface FirebaseIdentityAuthConfig extends ActionCeiling {
  readonly auth: Auth
  readonly options?: never
  readonly appName?: never
  readonly persistence?: never
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

/**
 * A bound the caller can walk away from. The SDK call cannot be cancelled, so
 * the timeout — and any newer attempt that supersedes this one — only abandons
 * our side: the caller is rejected and every late resolve or reject from the
 * abandoned SDK promise is suppressed, so it never reaches the caller or the
 * downstream handler while a retry is already in flight. One runner per action
 * so a reset never supersedes a sign-in.
 */
function boundedRunner(
  timeoutMs: number | undefined
): <T>(run: Promise<T>) => Promise<T> {
  if (timeoutMs === undefined) return (run) => run
  let abandonInFlight: ((reason: Error) => void) | undefined
  return <T>(run: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      abandonInFlight?.(
        new Error('Firebase auth action superseded by a newer attempt')
      )
      let abandoned = false
      function abandon(reason: Error): void {
        abandoned = true
        clearTimeout(timer)
        reject(reason)
      }
      const timer = setTimeout(
        () => abandon(new Error('Firebase auth action timed out')),
        timeoutMs
      )
      abandonInFlight = abandon
      const deliver = (settle: () => void): void => {
        if (abandoned) return
        clearTimeout(timer)
        abandonInFlight = undefined
        settle()
      }
      run.then(
        (value) => deliver(() => resolve(value)),
        (error: unknown) => deliver(() => reject(error))
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
  if (config.auth) {
    const { auth } = config
    return () => auth
  }
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
  const boundedSignIn = boundedRunner(actionTimeoutMs)
  const boundedReset = boundedRunner(actionTimeoutMs)

  return {
    [identityBrand]: true,
    onUserChanged: (callback) => onAuthStateChanged(auth(), callback),
    signInWithGoogle: () => signInWithPopup(auth(), googleProvider()),
    signInWithGitHub: () => signInWithPopup(auth(), githubProvider()),
    signInWithEmail: (email, password) =>
      boundedSignIn(signInWithEmailAndPassword(auth(), email, password)),
    createUserWithEmail: (email, password) =>
      createUserWithEmailAndPassword(auth(), email, password),
    sendPasswordReset: (email) =>
      boundedReset(sendPasswordResetEmail(auth(), email)).catch(
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
