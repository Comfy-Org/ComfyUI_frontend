/**
 * Firebase configuration read at runtime from the Cloud app's own
 * `/api/features`, instead of the value every host used to bake in at build
 * time. Framework-free and dependency-free: it returns a plain options
 * object and never imports the Firebase SDK, so a caller decides if and when
 * to initialize it.
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

/**
 * Fetches `firebase_config` from the given Cloud origin's `/api/features`, an
 * unauthenticated, cross-origin-readable endpoint. Resolves `undefined` on
 * any problem — a non-OK response, an unparseable or malformed body, a
 * missing required field, a network failure, or a fetch that outruns
 * `timeoutMs` — so a caller can always fall back without branching on why
 * the fetch failed.
 */
export async function fetchFirebaseConfig(
  cloudBaseUrl: string,
  options: FetchFirebaseConfigOptions = {}
): Promise<RuntimeFirebaseOptions | undefined> {
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
    if (typeof body !== 'object' || body === null) return undefined
    return parseFirebaseConfig(
      (body as Record<string, unknown>).firebase_config
    )
  } catch {
    return undefined
  } finally {
    clearTimeout(timeout)
  }
}
