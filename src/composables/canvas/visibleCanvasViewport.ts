import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function visibleCanvasViewport(canvas: LGraphCanvas): ReadOnlyRect {
  const panel = useAgentPanelStore()
  const canvasRect = canvas.canvas.getBoundingClientRect()
  const width = canvasRect.width || canvas.canvas.width / canvas.dpr
  const height = canvasRect.height || canvas.canvas.height / canvas.dpr
  const coveredWidth = panel.isVisible ? panel.width : 0
  return [0, 0, Math.max(width - coveredWidth, 0), height]
}
