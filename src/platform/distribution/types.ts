/**
 * Distribution types and compile-time constants for managing
 * multi-distribution builds (Desktop, Localhost, Cloud)
 */

export type Distribution = 'desktop' | 'localhost' | 'cloud'

declare global {
  const __DISTRIBUTION__: Distribution
  const __IS_NIGHTLY__: boolean
}

/**
 * Current distribution - replaced at compile time.
 *
 * Exported for the rare consumer that needs the distribution as a value rather
 * than one of the `isDesktop` / `isCloud` booleans (e.g. signup attribution,
 * which reports which build an account was created from). Prefer the booleans
 * for branching so dead-code elimination can strip the untaken branch.
 */
export const DISTRIBUTION: Distribution = __DISTRIBUTION__

export const isDesktop = DISTRIBUTION === 'desktop'
export const isCloud = DISTRIBUTION === 'cloud'

/**
 * Whether this is a nightly build (from main branch).
 * Nightly builds may show experimental features and surveys.
 * @public
 */
export const isNightly = __IS_NIGHTLY__
