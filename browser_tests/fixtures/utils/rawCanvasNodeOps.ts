import type { Page } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'
import type { SerializedNodeId } from '@/types/nodeId'

/**
 * Minimal canvas node interactions for specs that boot through
 * `agentPanelFixture` (a raw `page`, not `comfyPageFixture`) and so cannot use
 * `comfyPage.nodeOps`/`NodeReference`, which are typed against `ComfyPage`.
 * Mirrors the same `window.app` reads `browser_tests/fixtures/utils/litegraphUtils.ts`
 * uses, scoped to whichever graph `window.app.canvas.graph` currently shows
 * (the root graph, or the subgraph the canvas has navigated into).
 */

async function clientPosOfNode(
  page: Page,
  nodeId: SerializedNodeId
): Promise<{ x: number; y: number }> {
  const id = toNodeId(nodeId)
  const [x, y]: [number, number] = await page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    if (!node)
      throw new Error(`node ${String(id)} not found in the current graph`)
    const [x, y] = node.pos
    const [w, h] = node.size
    return window.app!.canvasPosToClientPos([x + w / 2, y + h / 2])
  }, id)
  return { x, y }
}

async function clientPosOfNodeTitle(
  page: Page,
  nodeId: SerializedNodeId
): Promise<{ x: number; y: number }> {
  const id = toNodeId(nodeId)
  const [x, y]: [number, number] = await page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    if (!node)
      throw new Error(`node ${String(id)} not found in the current graph`)
    const [x, y] = node.pos
    const [w] = node.size
    const titleHeight = window.LiteGraph!['NODE_TITLE_HEIGHT']
    return window.app!.canvasPosToClientPos([x + w / 2, y - titleHeight / 2])
  }, id)
  return { x, y }
}

/** Node ids present in whichever graph the canvas currently shows. */
export async function currentGraphNodeIds(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    window.app!.canvas.graph!.nodes.map((node) => String(node.id))
  )
}

/** True once the canvas has navigated into a subgraph (root graphs have no `inputNode`). */
export async function isInsideSubgraph(page: Page): Promise<boolean> {
  return page.evaluate(() => 'inputNode' in (window.app!.canvas.graph ?? {}))
}

/** Double-clicks the node's body to descend into it (subgraph nodes only). */
export async function enterSubgraphNode(
  page: Page,
  nodeId: SerializedNodeId
): Promise<void> {
  const pos = await clientPosOfNode(page, nodeId)
  await page.mouse.dblclick(pos.x, pos.y, { delay: 5 })
}

/** Clicks a node's title bar, selecting it (matches `NodeReference.click('title')`). */
export async function clickNodeTitle(
  page: Page,
  nodeId: SerializedNodeId
): Promise<void> {
  const pos = await clientPosOfNodeTitle(page, nodeId)
  await page.mouse.click(pos.x, pos.y)
}
