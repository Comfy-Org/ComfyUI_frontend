import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function visibleCanvasViewport(
  canvas: Pick<LGraphCanvas, 'ds'>
): ReadOnlyRect {
  const panel = useAgentPanelStore()
  const [width, height] = canvas.ds.getViewportSize()
  const coveredWidth = panel.isVisible ? panel.width : 0
  return [0, 0, Math.max(width - coveredWidth, 0), height]
}
