import { get } from 'es-toolkit/compat'

/**
 * Machine-readable error code returned in a 403 response body by the cloud
 * backend (comfy-api at api.comfy.org and the cloud ingest server) when the
 * account has been banned. It distinguishes a ban from an ordinary
 * access-denied 403.
 */
const ACCOUNT_BANNED_CODE = 'ACCOUNT_BANNED'

export function isAccountBannedResponseBody(body: unknown): boolean {
  return get(body, 'code') === ACCOUNT_BANNED_CODE
}

type AccountBannedListener = () => void

const listeners = new Set<AccountBannedListener>()

/**
 * Subscribe to account-ban detection. Returns an unsubscribe function.
 *
 * Detection is decoupled from handling so any client that talks to an
 * authenticated cloud surface (the local ComfyUI server on cloud, or the
 * registry at api.comfy.org on every distribution) can report a ban through one
 * channel, while the app decides how to surface it (route to a banned page on
 * cloud, toast on local).
 */
export function onAccountBanned(listener: AccountBannedListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function notifyAccountBanned(): void {
  for (const listener of listeners) {
    listener()
  }
}
