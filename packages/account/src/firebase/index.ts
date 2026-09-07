/**
 * The package-owned identity entry. Hosts pass Firebase configuration —
 * including the persistence choice — and get back the identity surface the
 * session core binds to plus the sign-in actions.
 *
 * Popup, never `signInWithRedirect`: the redirect flow is broken under
 * Safari's ITP for cross-origin helper domains, which is why the cloud app
 * is popup-only too. Provider scopes and the `select_account` prompt mirror
 * the cloud app's provider setup in src/stores/authStore.ts.
 *
 * This entry is the one place the package touches the Firebase SDK;
 * importGuard.test.ts holds `./core` to that boundary.
 */
import type { FirebaseOptions } from 'firebase/app'
import { getApps, initializeApp } from 'firebase/app'
import type { Persistence, User, UserCredential } from 'firebase/auth'
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth'

export interface FirebaseIdentityConfig {
  readonly options: FirebaseOptions
  /** Named app: never contend with a default app another script creates. */
  readonly appName?: string
  /** Host-selected persistence; Firebase's default when omitted. */
  readonly persistence?: Persistence
  /**
   * Ceiling on the network-shaped actions (email sign-in/sign-up, password
   * reset). Popup sign-in stays unbounded: the user may legitimately take
   * minutes, and the SDK raises its own cancellation errors.
   */
  readonly actionTimeoutMs?: number
}

export interface FirebaseIdentity {
  /**
   * Fires with the restored user (or null) once Firebase settles, then on
   * every change. This is the `IdentityPort` the session core binds to.
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

const DEFAULT_ACTION_TIMEOUT_MS = 15_000

function bounded<T>(run: Promise<T>, timeoutMs: number): Promise<T> {
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

export function createFirebaseIdentity(
  config: FirebaseIdentityConfig
): FirebaseIdentity {
  const appName = config.appName ?? 'comfy-account'
  const actionTimeoutMs = config.actionTimeoutMs ?? DEFAULT_ACTION_TIMEOUT_MS

  const auth = () => {
    const existing = getApps().find((app) => app.name === appName)
    if (existing) return getAuth(existing)
    const app = initializeApp(config.options, appName)
    return config.persistence
      ? initializeAuth(app, { persistence: config.persistence })
      : getAuth(app)
  }

  return {
    onUserChanged: (callback) => onAuthStateChanged(auth(), callback),
    signInWithGoogle: () => signInWithPopup(auth(), googleProvider()),
    signInWithGitHub: () => signInWithPopup(auth(), githubProvider()),
    signInWithEmail: async (email, password) => {
      const { signInWithEmailAndPassword } = await import('firebase/auth')
      return bounded(
        signInWithEmailAndPassword(auth(), email, password),
        actionTimeoutMs
      )
    },
    createUserWithEmail: async (email, password) => {
      const { createUserWithEmailAndPassword } = await import('firebase/auth')
      return bounded(
        createUserWithEmailAndPassword(auth(), email, password),
        actionTimeoutMs
      )
    },
    sendPasswordReset: async (email) => {
      const { sendPasswordResetEmail } = await import('firebase/auth')
      return bounded(sendPasswordResetEmail(auth(), email), actionTimeoutMs)
    },
    signOut: async () => {
      const { signOut } = await import('firebase/auth')
      return signOut(auth())
    }
  }
}
