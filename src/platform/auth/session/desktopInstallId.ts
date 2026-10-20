import type { ComfyDesktop2Bridge } from '@/types'

/**
 * The per-installation id when the frontend is hosted by Comfy Desktop, else
 * null. Comfy Desktop exposes it synchronously on the `__comfyDesktop2`
 * bridge (`getInstallId`); it is a non-PII, stable-per-machine value sent to
 * cloud as the `X-Comfy-Install-Id` header for request attribution.
 *
 * Returns null on plain web (no bridge) and on Desktop builds predating the
 * `getInstallId` method, so callers omit the header in those cases.
 *
 * The cast is intentional: `getInstallId` is additive on the bridge and may
 * not yet be present in the pinned `@comfyorg/comfyui-desktop-bridge-types`
 * version. Once that package is bumped the cast becomes a no-op.
 */
export function getDesktopInstallId(): string | null {
  const bridge = window.__comfyDesktop2 as
    | (ComfyDesktop2Bridge & { getInstallId?: () => string })
    | undefined
  try {
    return bridge?.getInstallId?.() ?? null
  } catch {
    return null
  }
}
