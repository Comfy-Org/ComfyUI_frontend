/**
 * Distribution types and compile-time constants for managing
 * multi-distribution builds (Desktop, Localhost, Cloud)
 */

declare global {
  const __DISTRIBUTION__: 'desktop' | 'localhost' | 'cloud'
  const __IS_NIGHTLY__: boolean
}

export type Distribution = typeof __DISTRIBUTION__

export const DISTRIBUTION: Distribution = __DISTRIBUTION__

export const isDesktop = DISTRIBUTION === 'desktop'
export const isCloud = DISTRIBUTION === 'cloud'

/**
 * Whether this is a nightly build (from main branch).
 * Nightly builds may show experimental features and surveys.
 */
export const isNightly = __IS_NIGHTLY__
