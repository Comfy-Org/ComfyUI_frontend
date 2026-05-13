/**
 * Shared event infrastructure for the ComfyUI extension API.
 *
 * @packageDocumentation
 */

/**
 * A typed event handler function.
 *
 * @typeParam E - The event payload type.
 * @example
 * ```ts
 * const handler: Handler<WidgetValueChangeEvent<number>> = (e) => {
 *   console.log(e.oldValue, '->', e.newValue)
 * }
 * ```
 */
export type Handler<E> = (event: E) => void

/**
 * A typed async-capable event handler. Only valid for events that explicitly
 * support async handling (currently only `beforeSerialize`).
 *
 * @typeParam E - The event payload type.
 */
export type AsyncHandler<E> = (event: E) => void | Promise<void>

/**
 * Cleanup function returned by `on()` — call to remove the listener.
 *
 * @example
 * ```ts
 * const off = node.on('executed', handler)
 * // later:
 * off()
 * ```
 */
export type Unsubscribe = () => void
