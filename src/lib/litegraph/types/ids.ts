/**
 * ID types for litegraph entities.
 * These are branded types that can be used without importing runtime modules.
 */

/**
 * Node ID type.
 * @remarks Re-exported from LGraphNode for backwards compatibility,
 * but defined here to avoid circular imports.
 */
export type NodeId = number | string

/**
 * Link ID type.
 * @remarks Re-exported from LLink for backwards compatibility,
 * but defined here to avoid circular imports.
 */
export type LinkId = number

/**
 * Reroute ID type.
 * @remarks Re-exported from Reroute for backwards compatibility,
 * but defined here to avoid circular imports.
 */
export type RerouteId = number
