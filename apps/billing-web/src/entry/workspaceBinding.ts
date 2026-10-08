/**
 * The workspace this tab's session is bound to, once an entry link has named
 * one: a tab-scoped id that outlives any single route so the sign-in
 * redirect, a reload, and this app's own internal links that do not repeat
 * `workspace` all keep minting for the same target. `useBillingEntry`'s entry
 * is route-scoped and gets overwritten by every navigation, including the ones
 * this app makes for itself, so it cannot hold this by itself.
 *
 * Read from `window.location` at import time rather than waiting for the
 * router's first guard: `App.vue` reads the session (and so constructs the
 * session client) from its own `setup()`, which Vue runs before the router's
 * first navigation resolves, so a binding sourced only from the router guard
 * would lose the very first entry link. sessionStorage then carries it
 * through any navigation that does not repeat the parameter.
 */
import { parseBillingEntry } from '@comfyorg/billing-contract'

const STORAGE_KEY = 'comfy.billing-web.workspace.v1'

function readStorage(): string | undefined {
  try {
    return globalThis.sessionStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

function writeStorage(id: string): void {
  try {
    globalThis.sessionStorage.setItem(STORAGE_KEY, id)
  } catch {
    // A binding that only lives in memory still works for this tab.
  }
}

function fromLocation(): string | undefined {
  const result = parseBillingEntry(window.location.href)
  return result.status === 'ok' ? result.entry.workspaceId : undefined
}

let bound: string | undefined = fromLocation() ?? readStorage()
if (bound !== undefined) writeStorage(bound)

export function boundWorkspaceId(): string | undefined {
  return bound
}

/**
 * Rebinds the tab to a newly-arrived entry's workspace. Returns whether the
 * binding actually changed, so a caller can tell a fresh link from one that
 * only repeats the workspace already bound.
 */
export function bindEntryWorkspace(id: string): boolean {
  if (id === bound) return false
  bound = id
  writeStorage(id)
  return true
}
