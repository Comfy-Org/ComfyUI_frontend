/**
 * Consulted by `keybindHandler` before it dispatches the default bare-Escape
 * keybinding (normally `Comfy.Graph.ExitSubgraph`). A handler returns true to
 * mark the event handled, which suppresses that dispatch; it is responsible
 * for calling `event.preventDefault()` itself if it wants to.
 *
 * This lives in `platform/` so a workbench feature (e.g. the agent composer)
 * can make its own runtime state win over the default Escape keybinding
 * without `keybindingService` importing from `workbench/`, which the
 * layer-architecture lint rule forbids.
 */
export type EscapeOverride = (event: KeyboardEvent) => boolean

const overrides: EscapeOverride[] = []

/**
 * Registers a handler consulted on every bare Escape keydown that would
 * otherwise dispatch the default keybinding. Returns an unregister function.
 *
 * Handlers are consulted most-recently-registered first, and the first one
 * to return true wins. In practice there is at most one registrant at a
 * time, so this ordering rarely matters.
 */
export function registerEscapeOverride(handler: EscapeOverride): () => void {
  overrides.push(handler)
  return () => {
    const index = overrides.indexOf(handler)
    if (index !== -1) overrides.splice(index, 1)
  }
}

/** True if a registered handler claimed the event. */
export function consultEscapeOverride(event: KeyboardEvent): boolean {
  for (let i = overrides.length - 1; i >= 0; i--) {
    if (overrides[i](event)) return true
  }
  return false
}

/** Resets shared state between tests. */
export function clearEscapeOverrides(): void {
  overrides.length = 0
}
