import { safeInternalPath } from '@comfyorg/account-core/redirect'

const HOME = '/'

/**
 * Where a visitor may be sent after sign-in: a same-origin absolute path,
 * else the app entry. An absolute URL, a protocol-relative prefix, or a path
 * hiding one behind a stripped control char never leaves this origin.
 */
export function safeReturnTo(raw: unknown): string {
  const candidate = Array.isArray(raw) ? raw[0] : raw
  return safeInternalPath(
    typeof candidate === 'string' ? candidate : undefined,
    window.location.origin,
    HOME
  )
}
