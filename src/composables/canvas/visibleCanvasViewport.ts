import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

/**
 * The region of the canvas the user can actually see, excluding the width the
 * docked agent panel covers. Framing against this rather than the full canvas
 * keeps nodes from landing behind the panel while it is open.
 *
 * Kept apart from `useFocusNode` so callers that only need the viewport - the
 * node selection store among them - don't transitively pull in `@/scripts/app`.
 */
export function visibleCanvasViewport(canvas: LGraphCanvas): ReadOnlyRect {
  const agentPanelStore = useAgentPanelStore()
  const width = canvas.canvas.width / window.devicePixelRatio
  const height = canvas.canvas.height / window.devicePixelRatio
  const coveredWidth =
    agentPanelStore.enabled && agentPanelStore.isOpen
      ? agentPanelStore.width
      : 0
  return [0, 0, Math.max(width - coveredWidth, 0), height]
}
