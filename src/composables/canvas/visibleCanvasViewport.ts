import type { ReadOnlyRect } from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraphCanvas } from '@comfyorg/litegraph/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function visibleCanvasViewport(
  canvas: Pick<LGraphCanvas, 'ds'>
): ReadOnlyRect {
  const panel = useAgentPanelStore()
  const [width, height] = canvas.ds.getViewportSize()
  const coveredWidth = panel.isVisible ? panel.width : 0
  const uncoveredWidth = width - coveredWidth
  return [0, 0, uncoveredWidth > 0 ? uncoveredWidth : width, height]
}
