import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'

import type { PromptRole } from './tourSequence'

/**
 * View-only navigation for the prompt step. Entering a subgraph and restoring
 * the prior view are `canvas.setGraph` calls only — no graph mutation (ADR-0008).
 */

/**
 * Enter the prompt's subgraph and focus its inner text input. Returns `false`
 * on any failure so the caller falls back to spotlighting `target.portFallback`.
 */
export async function focusPromptTarget(target: PromptRole): Promise<boolean> {
  const canvas = useCanvasStore().canvas
  if (!canvas) return false

  const node = app.rootGraph.getNodeById(target.subgraphNodeId)
  if (!node?.isSubgraphNode()) return false

  try {
    canvas.openSubgraph(node.subgraph, node)
    return await focusInnerInput(target.innerNodeId)
  } catch {
    return false
  }
}

/** Return the canvas to the root graph. Safe to call even if never entered. */
export function restoreView() {
  useCanvasStore().canvas?.setGraph(app.rootGraph)
}

function focusInnerInput(
  innerNodeId: PromptRole['innerNodeId']
): Promise<boolean> {
  const selector = `[data-node-id="${CSS.escape(innerNodeId)}"]`
  return new Promise((resolve) => {
    // Vue node DOM mounts on the next frame.
    requestAnimationFrame(() => {
      const input = document.querySelector<
        HTMLTextAreaElement | HTMLInputElement
      >(`${selector} textarea, ${selector} input`)
      if (!input) {
        resolve(false)
        return
      }
      input.focus()
      resolve(document.activeElement === input)
    })
  })
}
