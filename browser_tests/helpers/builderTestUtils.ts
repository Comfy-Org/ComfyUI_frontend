import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import type { AppModeHelper } from '../fixtures/helpers/AppModeHelper'
import type { NodeReference } from '../fixtures/utils/litegraphUtils'

import { comfyExpect } from '../fixtures/ComfyPage'
import { fitToViewInstant } from './fitToView'

interface BuilderSetupResult {
  inputNodeTitle: string
  widgetNames: string[]
}

/**
 * Enter builder on the default workflow and select I/O.
 *
 * Loads the default workflow, optionally transforms it (e.g. convert a node
 * to subgraph), then enters builder mode and selects inputs + outputs.
 *
 * @param comfyPage - The page fixture.
 * @param prepareGraph - Optional callback to transform the graph before
 *   entering builder. Receives the KSampler node ref and returns the
 *   input node title and widget names to select.
 *   Defaults to KSampler with its first widget.
 *   Mutually exclusive with widgetNames.
 * @param widgetNames - Widget names to select from the KSampler node.
 *   Only used when prepareGraph is not provided.
 *   Mutually exclusive with prepareGraph.
 */
export async function setupBuilder(
  comfyPage: ComfyPage,
  prepareGraph?: (ksampler: NodeReference) => Promise<BuilderSetupResult>,
  widgetNames?: string[]
): Promise<void> {
  const { appMode } = comfyPage
  await comfyPage.workflow.loadWorkflow('default')

  const ksampler = await comfyPage.nodeOps.getNodeRefById('3')

  const { inputNodeTitle, widgetNames: inputWidgets } = prepareGraph
    ? await prepareGraph(ksampler)
    : { inputNodeTitle: 'KSampler', widgetNames: widgetNames ?? ['seed'] }

  await fitToViewInstant(comfyPage)
  await appMode.enterBuilder()
  await appMode.steps.goToInputs()

  for (const name of inputWidgets) {
    await appMode.select.selectInputWidget(inputNodeTitle, name)
  }

  await appMode.steps.goToOutputs()
  await appMode.select.selectOutputNode('Save Image')
}

/**
 * Convert the KSampler to a subgraph, then enter builder with I/O selected.
 */
export async function setupSubgraphBuilder(
  comfyPage: ComfyPage
): Promise<void> {
  await setupBuilder(comfyPage, async (ksampler) => {
    await ksampler.click('title')
    await ksampler.convertToSubgraph()
    await comfyPage.nextFrame()

    return {
      inputNodeTitle: 'New Subgraph',
      widgetNames: ['seed']
    }
  })
}

/**
 * Open the save-as dialog, fill name + view type, click save,
 * and wait for the success dialog.
 */
export async function builderSaveAs(
  appMode: AppModeHelper,
  workflowName: string,
  viewType: 'App' | 'Node graph' = 'App'
) {
  await appMode.footer.saveAsButton.click()
  await comfyExpect(appMode.saveAs.nameInput).toBeVisible({ timeout: 5000 })
  await appMode.saveAs.fillAndSave(workflowName, viewType)
  await comfyExpect(appMode.saveAs.successMessage).toBeVisible({
    timeout: 5000
  })
}

/**
 * Load a different workflow, then reopen the named one from the sidebar.
 * Caller must ensure the page is in graph mode (not builder or app mode)
 * before calling.
 */
export async function openWorkflowFromSidebar(
  comfyPage: ComfyPage,
  name: string
) {
  await comfyPage.workflow.loadWorkflow('default')
  await comfyPage.nextFrame()
  const { workflowsTab } = comfyPage.menu
  await workflowsTab.open()
  await workflowsTab.getPersistedItem(name).dblclick()
  await comfyPage.nextFrame()

  await comfyExpect(async () => {
    const path = await comfyPage.workflow.getActiveWorkflowPath()
    expect(path).toContain(name)
  }).toPass({ timeout: 5000 })
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
