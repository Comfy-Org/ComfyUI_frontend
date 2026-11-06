import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'
import type { LegacyGraphInstancePatches } from '@e2e/types/globals'

export function readLegacyGraphInstancePatches(
  comfyPage: ComfyPage
): Promise<LegacyGraphInstancePatches> {
  return comfyPage.page.evaluate(() => window.__legacyGraphInstancePatches!)
}

export async function removeGraphNode(
  comfyPage: ComfyPage,
  node: NodeReference
) {
  await comfyPage.page.evaluate((id) => {
    const graph = window.app!.graph
    graph.remove(graph.getNodeById(id)!)
  }, node.id)
  await comfyPage.nextFrame()
}

export async function switchToWorkflowTab(comfyPage: ComfyPage, index: number) {
  const { topbar } = comfyPage.menu
  await topbar.getTab(index).click()
  await expect(topbar.getTab(index).and(topbar.getActiveTab())).toBeVisible()
  await comfyPage.workflow.waitForWorkflowIdle()
}

export async function openSecondWorkflowTab(comfyPage: ComfyPage) {
  const firstRoot = await comfyPage.page.evaluate(() => window.app!.graph.id)
  await comfyPage.workflow.newBlankWorkflow()
  await expect(comfyPage.menu.topbar.tabs).toHaveCount(2)
  await switchToWorkflowTab(comfyPage, 0)
  await expect
    .poll(() => comfyPage.page.evaluate(() => window.app!.graph.id))
    .toBe(firstRoot)
  await switchToWorkflowTab(comfyPage, 1)
  await expect
    .poll(() => comfyPage.page.evaluate(() => window.app!.graph.id))
    .not.toBe(firstRoot)
}
