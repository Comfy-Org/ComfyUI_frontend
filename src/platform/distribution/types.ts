/**
 * Distribution types and compile-time constants for managing
 * multi-distribution builds (legacy Desktop, Localhost, Cloud)
 */

export type Distribution = 'desktop' | 'localhost' | 'cloud'

declare global {
  const __DISTRIBUTION__: Distribution
  const __IS_NIGHTLY__: boolean
}

export const DISTRIBUTION: Distribution = __DISTRIBUTION__

/**
 * Whether this is the `DISTRIBUTION=desktop` build, which only the legacy
 * Electron app (Desktop 1, `window.electronAPI`) ships.
 *
 * False inside Comfy-Desktop (Desktop 2): it runs the standard localhost
 * build. Use {@link isComfyDesktop2} to detect Desktop 2.
 */
export const isLegacyDesktopBuild = DISTRIBUTION === 'desktop'
export const isCloud = DISTRIBUTION === 'cloud'

/**
 * Whether the page is hosted by Comfy-Desktop (Desktop 2), which injects
 * `window.__comfyDesktop2`. Runtime check: true for any build Desktop 2 loads,
 * including cloud.
 */
export function isComfyDesktop2(): boolean {
  return Boolean(window.__comfyDesktop2)
}

/**
 * Whether this is a nightly build (from main branch).
 * Nightly builds may show experimental features and surveys.
 */
export const isNightly = __IS_NIGHTLY__
