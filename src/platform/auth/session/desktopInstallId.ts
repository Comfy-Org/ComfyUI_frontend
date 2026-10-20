/**
 * The per-installation id when the frontend is hosted by Comfy Desktop, else
 * null. Comfy Desktop exposes it synchronously on the `__comfyDesktop2`
 * bridge (`getInstallId`); it is a non-PII, stable-per-machine value sent to
 * cloud as the `X-Comfy-Install-Id` header for request attribution.
 *
 * Returns null on plain web (no bridge) and on Desktop builds predating the
 * `getInstallId` method (it is optional on the bridge type), so callers omit
 * the header in those cases.
 */
export function getDesktopInstallId(): string | null {
  try {
    return window.__comfyDesktop2?.getInstallId?.() ?? null
  } catch {
    return null
  }
}
