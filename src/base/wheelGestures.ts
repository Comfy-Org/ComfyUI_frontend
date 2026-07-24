/**
 * Wheel events whose browser default would break the editing experience.
 * On macOS trackpads:
 *   - `ctrl/meta + wheel` (pinch-zoom) triggers page-level zoom, which
 *     pushes fixed-position UI (e.g. ComfyActionbar) off-screen with no
 *     recovery short of a page reload.
 *   - Horizontal-dominant wheel (two-finger horizontal swipe) triggers
 *     back/forward navigation, which leaves the workflow.
 *
 * Equal `|deltaX| == |deltaY|` (including idle 0/0 frames between meaningful
 * trackpad samples) intentionally falls on the false branch so native
 * vertical scroll wins on a tie.
 *
 * Components that intercept wheel events should suppress the default for
 * these gestures even when they otherwise let the browser scroll natively.
 */
export const isCanvasGestureWheel = (event: WheelEvent): boolean =>
  event.ctrlKey ||
  event.metaKey ||
  Math.abs(event.deltaX) > Math.abs(event.deltaY)
