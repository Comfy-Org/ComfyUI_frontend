import type { Page } from '@playwright/test'

/** Adds the given registered node types to the canvas, left to right. */
export async function addCanvasNodes(
  page: Page,
  types: string[]
): Promise<void> {
  await page.evaluate((nodeTypes) => {
    nodeTypes.forEach((nodeType, index) => {
      const node = window.LiteGraph!.createNode(nodeType)
      if (!node) throw new Error(`${nodeType} is not a registered node type`)
      node.pos = [120 + index * 240, 160]
      window.app!.graph.add(node)
    })
  }, types)
}
