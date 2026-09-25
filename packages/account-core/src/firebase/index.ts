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
import type { Auth, Dependencies, User, UserCredential } from 'firebase/auth'
import {
  GithubAuthProvider,
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  onIdTokenChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword
} from 'firebase/auth'

import type { AccountIdentity } from '../core/identity.js'
import { brandIdentity } from '../core/identity.js'
import { isFirebaseAuthErrorLike } from '../firebaseAuthError.js'
import type { CloudFeatures } from './configSource.js'
import { fetchCloudFeatures } from './configSource.js'

export interface FirebaseIdentityAppConfig {
  readonly options: FirebaseOptions | (() => FirebaseOptions)
  /** Named app: never contend with a default app another script creates. */
  readonly appName?: string
  /** One persistence or an ordered hierarchy, handed to `initializeAuth` as is; Firebase's default when omitted. */
  readonly persistence?: Dependencies['persistence']
  /** A host-owned `Auth` and package-owned app options are exclusive. */
  readonly auth?: never
}

/**
 * A host that already holds an `Auth` binds the entry to it: no second app,
 * no second persistence store.
 */
export interface FirebaseIdentityAuthConfig {
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
  /** Fires on every ID token change, refreshes included. */
  onTokenChanged: (callback: (user: User | null) => void) => () => void
  /** Resolves the app and `Auth` now; a no-op once resolved. */
  initialize: () => void
  /** Null until `initialize()` or a subscribing/sign-in call has resolved `Auth`. */
  currentUser: () => User | null
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

interface AuthResolver {
  resolve: () => Auth
  peek: () => Auth | undefined
}

/**
 * A pre-existing app under this name must be the same Firebase project, or
 * `Auth` binds to another project's session. Deliberately a "same project"
 * check on the fields that pick a session, not the SDK's byte-identical
 * compare: `appId` is Installations/Analytics, so omitting it from a partial
 * same-project config still binds rather than failing boot.
 */
function assertSameProject(
  existing: FirebaseOptions,
  requested: FirebaseOptions,
  appName: string
): void {
  const mismatch = (['projectId', 'apiKey', 'authDomain'] as const)
    .filter((key) => existing[key] !== requested[key])
    .join(', ')
  if (mismatch) {
    throw new Error(
      `Firebase app "${appName}" already exists for a different project (${mismatch})`
    )
  }
}

/**
 * Host persistence goes through `initializeAuth`, whether this entry creates
 * the named app or another script already did: Firebase allows one Auth per
 * app, so an Auth another module initialized with different dependencies
 * fails with `auth/already-initialized` instead of silently winning. Unlike
 * `getAuth`, `initializeAuth` wires no popup resolver of its own, and popup
 * sign-in throws `auth/argument-error` without one.
 */
function authResolver(config: FirebaseIdentityConfig): AuthResolver {
  if (config.auth) {
    const { auth } = config
    return { resolve: () => auth, peek: () => auth }
  }
  const appName = config.appName ?? 'comfy-account'
  let resolved: Auth | undefined
  const resolve = (): Auth => {
    if (resolved) return resolved
    // Resolve options before the lookup so the host's config thunk (its
    // unloaded-remote-config guard) always runs, even when reusing an app.
    const options =
      typeof config.options === 'function' ? config.options() : config.options
    const existing = getApps().find((app) => app.name === appName)
    if (existing) assertSameProject(existing.options, options, appName)
    const app = existing ?? initializeApp(options, appName)
    resolved = config.persistence
      ? initializeAuth(app, {
          persistence: config.persistence,
          popupRedirectResolver: browserPopupRedirectResolver
        })
      : getAuth(app)
    return resolved
  }
  return { resolve, peek: () => resolved }
}

export function createFirebaseIdentity(
  config: FirebaseIdentityConfig
): FirebaseIdentity {
  const { resolve: auth, peek } = authResolver(config)

  return {
    ...brandIdentity<User>({
      onUserChanged: (callback) => onAuthStateChanged(auth(), callback)
    }),
    onTokenChanged: (callback) => onIdTokenChanged(auth(), callback),
    initialize: () => {
      auth()
    },
    currentUser: () => peek()?.currentUser ?? null,
    signInWithGoogle: () => signInWithPopup(auth(), googleProvider()),
    signInWithGitHub: () => signInWithPopup(auth(), githubProvider()),
    signInWithEmail: (email, password) =>
      signInWithEmailAndPassword(auth(), email, password),
    createUserWithEmail: (email, password) =>
      createUserWithEmailAndPassword(auth(), email, password),
    sendPasswordReset: (email) =>
      sendPasswordResetEmail(auth(), email).catch(resolveUnknownEmailAsSent),
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

export interface ResolveFirebaseIdentityOptions {
  /** The Cloud origin whose `/api/features` names this app's Firebase project. */
  readonly cloudBaseUrl: string
  /** Named app: never contend with a default app another script creates. */
  readonly appName: string
  readonly persistence?: Dependencies['persistence']
  readonly timeoutMs?: number
}

/**
 * One `/api/features` fetch per `cloudBaseUrl`/`timeoutMs` pair, shared by
 * every reader of the document: `resolveFirebaseIdentity` and
 * `resolveStripePublishableKey` on the same pair read the same fetch instead
 * of each starting their own. Never rejects, a failed fetch settles `{}`,
 * which each field reader treats as absent.
 *
 * Memoized while a fetch is in flight or has produced a document with either
 * field present. A document with neither field is treated the same as a
 * failed fetch and evicts, matching `identityResolutions` below: this cache
 * cannot tell a transient failure (network error, timeout, malformed body)
 * from a Cloud origin that genuinely has neither Firebase nor Stripe
 * configured, and caching that ambiguity would silently defeat
 * `identityResolutions`'s own eviction once a caller retries through it.
 */
const featureResolutions = new Map<string, Promise<CloudFeatures>>()

function resolveCloudFeatures(
  cloudBaseUrl: string,
  timeoutMs: number | undefined
): Promise<CloudFeatures> {
  const key = `${cloudBaseUrl} ${timeoutMs ?? ''}`
  let resolution = featureResolutions.get(key)
  if (!resolution) {
    resolution = fetchCloudFeatures(cloudBaseUrl, { timeoutMs })
    // Evict on an unsuccessful settle so a transient failure does not wedge
    // every reader of this pair for the module's lifetime. Callers already
    // hold this promise directly, not a map lookup, so deleting it here
    // never orphans one.
    void resolution.then((features) => {
      if (
        !features.firebaseConfig &&
        !features.stripePublishableKey &&
        featureResolutions.get(key) === resolution
      ) {
        featureResolutions.delete(key)
      }
    })
    featureResolutions.set(key, resolution)
  }
  return resolution
}

/**
 * The single entry a host needs to go from a Cloud origin to a ready
 * identity: fetch `/api/features`, construct the app, and force `Auth` to
 * resolve now rather than on whichever caller first touches the identity, so
 * a config that fails the SDK's own checks (a bad key, a project mismatch on
 * `appName`) surfaces here instead of downstream. Settles `undefined` on any
 * failure along the way and never rejects, so a caller always gets either a
 * ready identity or a definite absence.
 *
 * Memoized per `appName`/`cloudBaseUrl` pair while a fetch is in flight or
 * has produced a ready identity, so every caller with the same pair shares
 * one fetch and one identity, and two pairs (two hosts, or two Cloud origins
 * in one process, as this package's own tests run) never share a result. An
 * unsuccessful settle evicts its entry, so a later call re-fetches rather
 * than replaying the same absence for the module's lifetime.
 */
const identityResolutions = new Map<
  string,
  Promise<FirebaseIdentity | undefined>
>()

export function resolveFirebaseIdentity(
  options: ResolveFirebaseIdentityOptions
): Promise<FirebaseIdentity | undefined> {
  const { cloudBaseUrl, appName, persistence, timeoutMs } = options
  const key = `${appName} ${cloudBaseUrl}`
  let resolution = identityResolutions.get(key)
  if (!resolution) {
    resolution = resolveCloudFeatures(cloudBaseUrl, timeoutMs).then(
      ({ firebaseConfig }) => {
        if (!firebaseConfig) return undefined
        try {
          const identity = createFirebaseIdentity({
            options: firebaseConfig,
            appName,
            persistence
          })
          identity.initialize()
          return identity
        } catch {
          return undefined
        }
      }
    )
    // Evict on an unsuccessful settle so a transient failure does not wedge
    // sign-in for the module's lifetime. Callers already hold this promise
    // directly, not a map lookup, so deleting it here never orphans one.
    void resolution.then((identity) => {
      if (!identity && identityResolutions.get(key) === resolution) {
        identityResolutions.delete(key)
      }
    })
    identityResolutions.set(key, resolution)
  }
  return resolution
}

export interface ResolveStripePublishableKeyOptions {
  /** The Cloud origin whose `/api/features` names this app's Stripe key. */
  readonly cloudBaseUrl: string
  readonly timeoutMs?: number
}

/**
 * The Stripe publishable key from the same `/api/features` document
 * `resolveFirebaseIdentity` reads. A host that calls both with the same
 * `cloudBaseUrl`/`timeoutMs` pays for one fetch, not two, `resolveCloudFeatures`
 * dedupes by that pair regardless of which field a caller asked for first.
 * Settles `undefined` on any failure and never rejects.
 */
export function resolveStripePublishableKey(
  options: ResolveStripePublishableKeyOptions
): Promise<string | undefined> {
  return resolveCloudFeatures(options.cloudBaseUrl, options.timeoutMs).then(
    ({ stripePublishableKey }) => stripePublishableKey
  )
}
