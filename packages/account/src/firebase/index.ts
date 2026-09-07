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

export function createFirebaseIdentity(
  config: FirebaseIdentityConfig
): FirebaseIdentity {
  const appName = config.appName ?? 'comfy-account'

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
      return signInWithEmailAndPassword(auth(), email, password)
    },
    createUserWithEmail: async (email, password) => {
      const { createUserWithEmailAndPassword } = await import('firebase/auth')
      return createUserWithEmailAndPassword(auth(), email, password)
    },
    sendPasswordReset: async (email) => {
      const { sendPasswordResetEmail } = await import('firebase/auth')
      return sendPasswordResetEmail(auth(), email)
    },
    signOut: async () => {
      const { signOut } = await import('firebase/auth')
      return signOut(auth())
    }
  }
}
