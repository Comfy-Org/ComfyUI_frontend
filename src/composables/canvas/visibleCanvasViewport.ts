import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

export function visibleCanvasViewport(canvas: LGraphCanvas): ReadOnlyRect {
  const panel = useAgentPanelStore()
  const width = canvas.canvas.width / window.devicePixelRatio
  const height = canvas.canvas.height / window.devicePixelRatio
  const coveredWidth = panel.enabled && panel.isOpen ? panel.width : 0
  return [0, 0, Math.max(width - coveredWidth, 0), height]
}
