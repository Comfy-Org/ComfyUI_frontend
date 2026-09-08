/**
 * Runtime gate for the CRDT follower (R1a).
 *
 * The follower is gated: with no URL param and no persisted opt-in it falls
 * back to the build-time env `VITE_AGENT_CRDT_FOLLOWER === 'true'`, and hosted
 * predeploy builds inject only the Stripe key, so a hosted preview bundle
 * would ship with the follower permanently inert. On this chain the gate
 * arrived with the follower itself, so there was never an env-only era to
 * recover from, and there is no `dev:cloud:crdt` script here.
 *
 * This gate adds a per-session runtime opt-in so ANY built bundle can enable
 * the follower without a rebuild:
 *
 *   `?agentCrdtFollower=1`  enable now and persist for this browser
 *   `?agentCrdtFollower=0`  disable now and clear the persisted opt-in
 *   (no param)              persisted opt-in, else the build-time flag
 *
 * An explicit URL param always wins, in both directions, so a dev build with
 * the env baked on can still be silenced for one session. localStorage access
 * is wrapped: in a context that denies storage (private mode, sandboxed
 * iframe) the gate degrades to param/flag behaviour instead of throwing.
 */

import { reportError } from '@/platform/telemetry/reportError'

export const FOLLOWER_STORAGE_KEY = 'Comfy.Agent.CrdtFollower'
export const FOLLOWER_QUERY_PARAM = 'agentCrdtFollower'

export interface FollowerGateInput {
  /** `import.meta.env.VITE_AGENT_CRDT_FOLLOWER` (build-time). */
  buildFlag: string | undefined
  /** `window.location.search`, including the leading `?` or empty. */
  search: string
  /** `window.localStorage`, or null when storage is unavailable. */
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null
}

export function resolveFollowerEnabled(input: FollowerGateInput): boolean {
  const param = new URLSearchParams(input.search).get(FOLLOWER_QUERY_PARAM)

  if (param === '1' || param === 'true') {
    trySet(input.storage, 'true')
    return true
  }
  if (param === '0' || param === 'false') {
    tryRemove(input.storage)
    return false
  }

  if (tryGet(input.storage) === 'true') return true

  return input.buildFlag === 'true'
}

function tryGet(storage: FollowerGateInput['storage']): string | null {
  try {
    return storage?.getItem(FOLLOWER_STORAGE_KEY) ?? null
  } catch (error) {
    reportError(error, {
      errorType: 'agent_crdt_follower_storage_access_failed'
    })
    return null
  }
}

function trySet(storage: FollowerGateInput['storage'], value: string): void {
  try {
    storage?.setItem(FOLLOWER_STORAGE_KEY, value)
  } catch (error) {
    reportError(error, {
      errorType: 'agent_crdt_follower_storage_access_failed'
    })
    // Storage denied: the session still enables via the param; it just will
    // not persist across navigations.
  }
}

function tryRemove(storage: FollowerGateInput['storage']): void {
  try {
    storage?.removeItem(FOLLOWER_STORAGE_KEY)
  } catch (error) {
    reportError(error, {
      errorType: 'agent_crdt_follower_storage_access_failed'
    })
    // Storage denied: nothing was persisted, so nothing to clear.
  }
}
