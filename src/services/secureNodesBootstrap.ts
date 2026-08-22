/**
 * ⚠️ INTERFACE DEBT (POC) — see ComfyUI_secure_nodes/DEBT.md entry F2.
 *
 * Startup hook that installs the secure-nodes extension host, if present.
 *
 * This file is the ONE place the frontend knows the overlay exists, and it is
 * deliberately promiscuous for the POC:
 *   - it hardcodes the overlay's URL under /secure-nodes/
 *   - it names the product ("secure nodes")
 *
 * End state: the frontend should load a *configured* host module by URL from a
 * setting/feature flag, with no product name in core — at which point this file
 * becomes a generic `loadConfiguredExtensionHost()`.
 *
 * Behaviour when the overlay is absent (the normal case): this is a no-op and
 * extensions load exactly as before. Any failure here is logged and swallowed
 * for the same reason.
 */
import { provideExtensionHost } from '@/services/extensionHostProvider'

const OVERLAY_ENTRY = '/secure-nodes/src/host-entry.mjs'
const GUEST_BOOTSTRAP = '/secure-nodes/src/guest.mjs'

const STICKY_KEY = 'Comfy.SecureNodes.Enabled'

/**
 * Enabled by `?secureNodes=1`, by a global set before boot (tests), or by a
 * previous opt-in.
 *
 * The query parameter alone is not enough to be usable: the app rewrites
 * `location` to `/#<workflow-id>` when a workflow is opened, which DISCARDS the
 * query string. The next reload then silently came up without the overlay —
 * the packs loaded unsandboxed and their node UI simply never appeared, with
 * nothing to explain why. So the opt-in is remembered once given.
 *
 * `?secureNodes=0` turns it back off, or there would be no way out of a sticky
 * flag except clearing site data.
 */
function isEnabled(): boolean {
  try {
    if (
      (globalThis as Record<string, unknown>).__COMFY_SECURE_NODES__ === true
    ) {
      return true
    }
    const param = new URLSearchParams(location.search).get('secureNodes')
    if (param === '1') {
      try {
        localStorage.setItem(STICKY_KEY, '1')
      } catch {
        // Private mode / storage disabled: still enabled for this page load.
      }
      return true
    }
    if (param === '0') {
      try {
        localStorage.removeItem(STICKY_KEY)
      } catch {
        /* nothing to clear */
      }
      return false
    }
    return localStorage.getItem(STICKY_KEY) === '1'
  } catch {
    return false
  }
}

export async function installSecureNodesHost(): Promise<void> {
  if (!isEnabled()) return
  try {
    // The overlay is served statically from public/, so it is NOT part of
    // Vite's module graph. A statically-analysable specifier gets rewritten to
    // `?import` and 500s in dev, so build the URL at runtime to keep it opaque
    // to import analysis and let the browser fetch it natively.
    const entryUrl = new URL(OVERLAY_ENTRY, globalThis.location.origin).href
    const mod = await import(/* @vite-ignore */ entryUrl)
    if (typeof mod?.install !== 'function') {
      console.warn('[secure-nodes] overlay has no install() export; skipping')
      return
    }
    const host = await mod.install({
      provideExtensionHost,
      comfy: (globalThis as Record<string, unknown>).comfy,
      bootstrapUrl: GUEST_BOOTSTRAP,
      // POC: take over every third-party extension. End state: driven by the
      // pack's sealed manifest / registry tier.
      match: () => true
    })
    ;(globalThis as Record<string, unknown>).__COMFY_SECURE_NODES_READY__ = true
    // Exposed for e2e inspection only (pack count, teardown). Carries no
    // authority a page script does not already have.
    ;(globalThis as Record<string, unknown>).__COMFY_SECURE_NODES_HOST__ = host
  } catch (error) {
    // Absent or broken overlay must never break the app.
    console.warn('[secure-nodes] overlay not installed:', error)
  }
}
