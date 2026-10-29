/**
 * The per-installation id when the frontend is hosted by Comfy Desktop, else
 * null.
 */
export function getDesktopInstallId(): string | null {
  try {
    return window.__comfyDesktop2?.getInstallId?.() ?? null
  } catch {
    return null
  }
}
