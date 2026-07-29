/**
 * The sign-in providers the app treats specially.
 *
 * Firebase reports provider ids as domains (`google.com`, `github.com`) and
 * varies them by platform, so callers match on a substring rather than an exact
 * value. Doing that in one place keeps adding a provider to a single edit.
 */
type AuthProvider = 'google' | 'github'

export function resolveAuthProvider(
  providerId: string | undefined
): AuthProvider | undefined {
  if (providerId?.includes('google')) return 'google'
  if (providerId?.includes('github')) return 'github'
  return undefined
}
