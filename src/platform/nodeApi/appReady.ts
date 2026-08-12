/**
 * "The application has finished starting."
 *
 * A pack's module body runs before node definitions are registered, which
 * matches what `registerExtension({ init })` promised. Nothing matched
 * `setup()` — the later point where the canvas, the settings and the graph all
 * exist — so converted packs either ran setup work too early or hand-rolled a
 * poll for the DOM to appear. Both are the same bug at different volumes.
 */
import type { Unsubscribe } from './widgetHandle'

let ready = false
const waiting = new Set<() => void>()

/** Called by the host once, at the point legacy `setup()` extensions ran. */
export function markAppReady(): void {
  if (ready) return
  ready = true
  for (const listener of waiting) run(listener)
  waiting.clear()
}

function run(listener: () => void): void {
  try {
    listener()
  } catch (error) {
    // One pack's failed startup must not abort the packs queued behind it.
    console.error('[nodeApi] lifecycle listener threw', error)
  }
}

export function onAppReady(listener: () => void): Unsubscribe {
  if (ready) {
    // Never synchronous: a caller that has not finished its own module body
    // would otherwise be re-entered partway through it.
    queueMicrotask(() => run(listener))
    return () => {}
  }
  waiting.add(listener)
  return () => waiting.delete(listener)
}

const workflowLoaded = new Set<() => void>()

/** Called by the host each time a workflow finishes being configured. */
export function notifyWorkflowLoaded(): void {
  for (const listener of [...workflowLoaded]) run(listener)
}

export function onWorkflowLoaded(listener: () => void): Unsubscribe {
  workflowLoaded.add(listener)
  return () => workflowLoaded.delete(listener)
}

/** Test seam. The host marks readiness exactly once per page load. */
export function resetAppReadyForTest(): void {
  ready = false
  waiting.clear()
  workflowLoaded.clear()
}
