/**
 * Identifies which workflow tracker owns the graph currently shown on the
 * canvas. Kept outside ChangeTracker so workflow loading can consult ownership
 * without importing the tracker implementation (and its navigation stores).
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
