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
  if (!(uncoveredWidth > 0)) return [0, 0, width, height]
  return [0, 0, uncoveredWidth, height]
}
