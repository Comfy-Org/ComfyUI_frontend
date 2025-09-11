/**
 * Timing Constants for State Machines
 *
 * Centralizes magic timing numbers with semantic names to improve
 * maintainability and make the codebase more self-documenting.
 */

export const TIMING_CONSTANTS = {
  /**
   * Frame rate interval for responsive checking (~60fps)
   * Used for canvas stability and condition checking
   */
  FRAME_RATE_INTERVAL: 16,

  /**
   * Fast checking interval for retry operations
   * Provides responsive state transitions without excessive CPU usage
   */
  RETRY_CHECK_INTERVAL: 50,

  /**
   * Backoff timing constants for progressive retry delays
   */
  BACKOFF: {
    /** Base time for first retry attempt (100ms) */
    MIN_BASE_TIME: 100,

    /** Maximum backoff time cap to prevent excessive delays (1000ms) */
    MAX_CAP_TIME: 1000,

    /** Multiplier for exponential backoff (2x each attempt) */
    MULTIPLIER: 2
  },

  /**
   * Default stability checking requirements
   */
  STABILITY: {
    /** Minimum consecutive stable checks required before declaring stable */
    DEFAULT_REQUIRED_CHECKS: 2,

    /** Minimum timeout for stability operations (2000ms) */
    MIN_TIMEOUT: 2000,

    /** CI environment timeout multiplier for reliability */
    CI_TIMEOUT_MULTIPLIER: 1.5,

    /** CI minimum timeout multiplier for aggressive timeouts */
    CI_MIN_TIMEOUT_MULTIPLIER: 3
  }
} as const

/**
 * Type helper for timing constant values
 */
export type TimingConstants = typeof TIMING_CONSTANTS
