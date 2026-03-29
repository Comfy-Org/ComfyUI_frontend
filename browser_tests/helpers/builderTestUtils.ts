import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import type { NodeReference } from '../fixtures/utils/litegraphUtils'

import { fitToViewInstant } from './fitToView'
import { getPromotedWidgetNames } from './promotedWidgets'

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
  await appMode.steps.goToInputs()
  await appMode.select.selectInputWidget(inputNode)

  await appMode.steps.goToOutputs()
  await appMode.select.selectOutputNode()

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
