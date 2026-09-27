/**
 * Cloud configuration read at runtime from the Cloud app's own
 * `/api/features`, instead of values every host used to bake in at build
 * time: the Firebase options, and the Stripe publishable key. Framework-free
 * and dependency-free — it returns plain data and never imports the Firebase
 * or Stripe SDKs, so a caller decides if and when to use either.
 *
 * `fetchCloudFeatures` fetches the document once and reads both fields from
 * it; `fetchFirebaseConfig` and `fetchStripePublishableKey` are single-field
 * conveniences built on top of it for a caller that only wants one. A host
 * that wants both still calls `fetchCloudFeatures` directly — calling both
 * conveniences would cost a second round trip.
 */

/** The subset of Firebase's own `FirebaseOptions` shape this fetch produces. */
export interface RuntimeFirebaseOptions {
  readonly apiKey: string
  readonly authDomain: string
  readonly projectId: string
  readonly appId: string
  readonly databaseURL?: string
  readonly storageBucket?: string
  readonly messagingSenderId?: string
  readonly measurementId?: string
}

export interface CloudFeatures {
  readonly firebaseConfig?: RuntimeFirebaseOptions
  /** Absent when the backend has no key configured, not an empty string. */
  readonly stripePublishableKey?: string
}

export interface FetchFirebaseConfigOptions {
  readonly fetchImpl?: typeof fetch
  readonly timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 5000

function readString(
  source: Record<string, unknown>,
  key: string
): string | undefined {
  const value = source[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Same required-field rule as the build-time reader: everything Firebase Auth needs is required, the rest carried through when present. */
function parseFirebaseConfig(
  value: unknown
): RuntimeFirebaseOptions | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const source = value as Record<string, unknown>
  const apiKey = readString(source, 'apiKey')
  const authDomain = readString(source, 'authDomain')
  const projectId = readString(source, 'projectId')
  const appId = readString(source, 'appId')
  if (!apiKey || !authDomain || !projectId || !appId) return undefined
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    databaseURL: readString(source, 'databaseURL'),
    storageBucket: readString(source, 'storageBucket'),
    messagingSenderId: readString(source, 'messagingSenderId'),
    measurementId: readString(source, 'measurementId')
  }
}

/** A non-string or empty value is treated the same as an absent field. */
function parseStripePublishableKey(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/**
 * Fetches `/api/features` from the given Cloud origin, an unauthenticated,
 * cross-origin-readable endpoint. Resolves `undefined` on any problem — a
 * non-OK response, an unparseable or non-object body, a network failure, or
 * a fetch that outruns `timeoutMs` — so a caller can always fall back
 * without branching on why the fetch failed.
 */
async function fetchFeaturesDocument(
  cloudBaseUrl: string,
  options: FetchFirebaseConfigOptions
): Promise<Record<string, unknown> | undefined> {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetchImpl(`${cloudBaseUrl}/api/features`, {
      signal: controller.signal
    })
    if (!response.ok) return undefined
    const body: unknown = await response.json()
    return typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : undefined
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Fetches the Cloud app's `/api/features` once and reads both the Firebase
 * options (`firebase_config`) and the Stripe publishable key
 * (`stripe_publishable_key`) from it. Either field is absent when the
 * response omits it, is malformed, or the fetch itself fails — this never
 * throws.
 */
export async function fetchCloudFeatures(
  cloudBaseUrl: string,
  options: FetchFirebaseConfigOptions = {}
): Promise<CloudFeatures> {
  const body = await fetchFeaturesDocument(cloudBaseUrl, options)
  if (!body) return {}
  return {
    firebaseConfig: parseFirebaseConfig(body.firebase_config),
    stripePublishableKey: parseStripePublishableKey(body.stripe_publishable_key)
  }
}

/** Single-field convenience over `fetchCloudFeatures`; see the module comment before pairing it with another single-field call. */
export async function fetchFirebaseConfig(
  cloudBaseUrl: string,
  options: FetchFirebaseConfigOptions = {}
): Promise<RuntimeFirebaseOptions | undefined> {
  const features = await fetchCloudFeatures(cloudBaseUrl, options)
  return features.firebaseConfig
}

/** Single-field convenience over `fetchCloudFeatures`; see the module comment before pairing it with another single-field call. */
export async function fetchStripePublishableKey(
  cloudBaseUrl: string,
  options: FetchFirebaseConfigOptions = {}
): Promise<string | undefined> {
  const features = await fetchCloudFeatures(cloudBaseUrl, options)
  return features.stripePublishableKey
}
