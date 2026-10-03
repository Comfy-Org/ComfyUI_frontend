import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function visibleCanvasViewport(
  canvas: Pick<LGraphCanvas, 'ds'>
): ReadOnlyRect {
  const panel = useAgentPanelStore()
  const [width, height] = canvas.ds.getViewportSize()
  const coveredWidth = panel.isVisible ? panel.width : 0
  const uncoveredWidth = width - coveredWidth
  // A panel wider than the canvas leaves nothing uncovered. Every fitting and
  // animation path rejects a non-positive rectangle, so returning one silently
  // discards the user's framing request instead of framing anything. Fall back
  // to the whole canvas: content partly behind the panel is still reachable by
  // panning, whereas a dropped fit leaves the canvas wherever it was.
  if (!(uncoveredWidth > 0)) return [0, 0, width, height]
  return [0, 0, uncoveredWidth, height]
}
