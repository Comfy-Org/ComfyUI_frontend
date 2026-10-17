/**
 * Identifies which workflow tracker owns the graph currently shown on the
 * canvas. Kept outside ChangeTracker so workflow loading can consult ownership
 * without importing the tracker implementation (and its navigation stores).
 *
 * Three states, reachable only through the transitions below:
 * - `null` — unbound. No tracker has claimed the canvas, so any tracker may
 *   capture it. This is the initial state and the one a test reset returns to.
 * - a tracker — owned. Only that tracker may capture; any other capturing is a
 *   mismatch and is reported.
 * - `false` — invalidated. A graph load is replacing the canvas, so no tracker
 *   owns it and every capture is skipped silently rather than reported, because
 *   a capture queued into that window is legitimate and merely stale.
 */
let canvasTracker: object | null | false = null

export function bindCanvasTracker(tracker: object): void {
  canvasTracker = tracker
}

export function invalidateCanvasTracker(): void {
  canvasTracker = false
}

export function isCanvasOwner(tracker: object): boolean {
  return canvasTracker === tracker
}

export function canCaptureCanvas(tracker: object): boolean {
  return canvasTracker === null || canvasTracker === tracker
}

export function isCanvasCaptureBlocked(): boolean {
  return canvasTracker === false
}

export function resetCanvasTrackerForTest(): void {
  canvasTracker = null
}
