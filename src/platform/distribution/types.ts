/**
 * Distribution types and compile-time constants for managing
 * multi-distribution builds (Desktop, Localhost, Cloud)
 */

type Distribution = 'desktop' | 'localhost' | 'cloud'

declare global {
  const __DISTRIBUTION__: Distribution
}

/** Current distribution - replaced at compile time */
const DISTRIBUTION: Distribution = __DISTRIBUTION__

/** Distribution type checks */
// const isDesktop = DISTRIBUTION === 'desktop'
// const isLocalhost = DISTRIBUTION === 'localhost'
export const isCloud = DISTRIBUTION === 'cloud'
