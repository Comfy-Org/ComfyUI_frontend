import { expect } from '@playwright/test'
import type { ConsoleMessage, Locator, Page } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import type { ComfyPage } from '../fixtures/ComfyPage'
import type { NodeReference } from '../fixtures/utils/litegraphUtils'

/**
 * Returns the widget-input slot Y position and the node title height
 * for the promoted "text" input on the SubgraphNode.
 *
 * The slot Y should be at the widget row, not the header. A value near
 * zero or negative indicates the slot is positioned at the header (the bug).
 */
export function getTextSlotPosition(page: Page, nodeId: string) {
  return page.evaluate((id) => {
    const node = window.app!.canvas.graph!.getNodeById(id)
    if (!node) return null

    const titleHeight = window.LiteGraph!.NODE_TITLE_HEIGHT

    for (const input of node.inputs) {
      if (!input.widget || input.type !== 'STRING') continue
      return {
        hasPos: !!input.pos,
        posY: input.pos?.[1] ?? null,
        widgetName: input.widget.name,
        titleHeight
      }
    }
    return null
  }, nodeId)
}

export async function serializeAndReload(comfyPage: ComfyPage): Promise<void> {
  // serialize() returns ComfyWorkflowJSON; Playwright JSON-serializes it across the boundary
  const serialized = await comfyPage.page.evaluate(() =>
    window.app!.graph!.serialize()
  )
  await comfyPage.page.evaluate(
    (workflow: ComfyWorkflowJSON) => window.app!.loadGraphData(workflow),
    serialized as ComfyWorkflowJSON
  )
  await comfyPage.nextFrame()
}

export async function convertDefaultKSamplerToSubgraph(
  comfyPage: ComfyPage
): Promise<NodeReference> {
  await comfyPage.workflow.loadWorkflow('default')
  const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
  await ksampler.click('title')
  const subgraphNode = await ksampler.convertToSubgraph()
  await comfyPage.nextFrame()
  return subgraphNode
}

export async function expectWidgetBelowHeader(
  nodeLocator: Locator,
  widgetLocator: Locator
): Promise<void> {
  const headerBox = await nodeLocator
    .locator('[data-testid^="node-header-"]')
    .boundingBox()
  const widgetBox = await widgetLocator.boundingBox()
  if (!headerBox || !widgetBox)
    throw new Error('Header or widget bounding box not found')
  expect(widgetBox.y).toBeGreaterThan(headerBox.y + headerBox.height)
}

export async function packAllInteriorNodes(
  comfyPage: ComfyPage,
  hostNodeId: string
): Promise<void> {
  await comfyPage.vueNodes.enterSubgraph(hostNodeId)
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
  await comfyPage.nextFrame()
  await comfyPage.canvas.click()
  await comfyPage.canvas.press('Control+a')
  await comfyPage.nextFrame()
  await comfyPage.page.evaluate(() => {
    const canvas = window.app!.canvas
    canvas.graph!.convertToSubgraph(canvas.selectedItems)
  })
  await comfyPage.nextFrame()
  await comfyPage.subgraph.exitViaBreadcrumb()
  await comfyPage.canvas.click()
  await comfyPage.nextFrame()
}

export function collectConsoleWarnings(
  page: Page,
  patterns: string[] = [
    'No link found',
    'Failed to resolve legacy -1',
    'No inner link found'
  ]
): { warnings: string[]; dispose: () => void } {
  const warnings: string[] = []
  const handler = (msg: ConsoleMessage) => {
    const text = msg.text()
    if (patterns.some((p) => text.includes(p))) {
      warnings.push(text)
    }
  }
  page.on('console', handler)
  return { warnings, dispose: () => page.off('console', handler) }
}
