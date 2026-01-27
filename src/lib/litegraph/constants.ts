/**
 * Symbols used for widget configuration in litegraph nodes.
 * Extracted to break circular dependencies between litegraphService and extensions.
 */

/**
 * Symbol used to access the config object on a widget.
 */
export const CONFIG = Symbol('CONFIG')

/**
 * Symbol used to access the config getter function on a widget.
 */
export const GET_CONFIG = Symbol('GET_CONFIG')
