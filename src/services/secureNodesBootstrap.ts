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

/** Enabled by ?secureNodes=1, or by a global set before boot (tests). */
function isEnabled(): boolean {
  try {
    if (
      (globalThis as Record<string, unknown>).__COMFY_SECURE_NODES__ === true
    ) {
      return true
    }
    return new URLSearchParams(location.search).get('secureNodes') === '1'
  } catch {
    return false
  }
}

export async function installSecureNodesHost(): Promise<void> {
  if (!isEnabled()) return
  try {
    const mod = await import(/* @vite-ignore */ OVERLAY_ENTRY)
    if (typeof mod?.install !== 'function') {
      console.warn('[secure-nodes] overlay has no install() export; skipping')
      return
    }
    await mod.install({
      provideExtensionHost,
      comfy: (globalThis as Record<string, unknown>).comfy,
      bootstrapUrl: GUEST_BOOTSTRAP,
      // POC: take over every third-party extension. End state: driven by the
      // pack's sealed manifest / registry tier.
      match: () => true
    })
    ;(globalThis as Record<string, unknown>).__COMFY_SECURE_NODES_READY__ = true
  } catch (error) {
    // Absent or broken overlay must never break the app.
    console.warn('[secure-nodes] overlay not installed:', error)
  }
}
