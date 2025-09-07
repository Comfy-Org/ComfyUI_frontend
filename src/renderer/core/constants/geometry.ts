/**
 * Geometry Constants
 *
 * Shared geometric constants used across multiple rendering systems.
 */

export const GEOMETRY = {
  /**
   * Reroute radius - CRITICAL: Must stay synchronized
   */
  REROUTE_RADIUS: 10,

  /**
   * Slot height for hit detection and layout calculations
   */
  SLOT_HEIGHT: 24
} as const
