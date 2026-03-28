import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import type { NodeReference } from '../fixtures/utils/litegraphUtils'

import { fitToViewInstant } from './fitToView'
import { getPromotedWidgetNames } from './promotedWidgets'

/** Click the first SaveImage/PreviewImage node on the canvas. */
async function selectOutputNode(comfyPage: ComfyPage) {
  const { page } = comfyPage

  const saveImageNodeId = await page.evaluate(() =>
    String(
      window.app!.rootGraph.nodes.find(
        (n: { type?: string }) =>
          n.type === 'SaveImage' || n.type === 'PreviewImage'
      )?.id
    )
  )
  const saveImageRef = await comfyPage.nodeOps.getNodeRefById(saveImageNodeId)
  await saveImageRef.centerOnNode()

  const canvasBox = await page.locator('#graph-canvas').boundingBox()
  if (!canvasBox) throw new Error('Canvas not found')
  await page.mouse.click(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2
  )
  await comfyPage.nextFrame()
}

/** Center on a node and click its first widget to select it as input. */
async function selectInputWidget(comfyPage: ComfyPage, node: NodeReference) {
  const { page } = comfyPage

  await comfyPage.canvasOps.setScale(1)
  await node.centerOnNode()

  const widgetRef = await node.getWidget(0)
  const widgetPos = await widgetRef.getPosition()
  const titleHeight = await page.evaluate(
    () => window.LiteGraph!['NODE_TITLE_HEIGHT'] as number
  )
  await page.mouse.click(widgetPos.x, widgetPos.y + titleHeight)
  await comfyPage.nextFrame()
}

/**
 * Enter builder on the default workflow and select I/O.
 *
 * Loads the default workflow, optionally transforms it (e.g. convert a node
 * to subgraph), then enters builder mode and selects inputs + outputs.
 *
 * @param comfyPage - The page fixture.
 * @param getInputNode - Returns the node to click for input selection.
 *   Receives the KSampler node ref and can transform the graph before
 *   returning the target node. Defaults to using KSampler directly.
 * @returns The node used for input selection.
 */
export async function setupBuilder(
  comfyPage: ComfyPage,
  getInputNode?: (ksampler: NodeReference) => Promise<NodeReference>
): Promise<NodeReference> {
  const { appMode } = comfyPage
  await comfyPage.workflow.loadWorkflow('default')

  const ksampler = await comfyPage.nodeOps.getNodeRefById('3')
  const inputNode = getInputNode ? await getInputNode(ksampler) : ksampler

  await fitToViewInstant(comfyPage)
  await appMode.enterBuilder()
  await appMode.goToInputs()
  await selectInputWidget(comfyPage, inputNode)

  await appMode.goToOutputs()
  await selectOutputNode(comfyPage)

  return inputNode
}

/**
 * Convert the KSampler to a subgraph, then enter builder with I/O selected.
 *
 * Returns the subgraph node reference for further interaction.
 */
export async function setupSubgraphBuilder(
  comfyPage: ComfyPage
): Promise<NodeReference> {
  return setupBuilder(comfyPage, async (ksampler) => {
    await ksampler.click('title')
    const subgraphNode = await ksampler.convertToSubgraph()
    await comfyPage.nextFrame()

    const promotedNames = await getPromotedWidgetNames(
      comfyPage,
      String(subgraphNode.id)
    )
    expect(promotedNames).toContain('seed')

    return subgraphNode
  })
}

/** Save the workflow, reopen it, and enter app mode. */
export async function saveAndReopenInAppMode(
  comfyPage: ComfyPage,
  workflowName: string
) {
  await comfyPage.menu.topbar.saveWorkflow(workflowName)

  const { workflowsTab } = comfyPage.menu
  await workflowsTab.open()
  await workflowsTab.getPersistedItem(workflowName).dblclick()
  await comfyPage.nextFrame()

  await comfyPage.appMode.toggleAppMode()
}
