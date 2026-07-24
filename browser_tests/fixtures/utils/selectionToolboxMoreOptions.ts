import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export async function openMoreOptionsMenu(
  comfyPage: ComfyPage,
  nodeTitle: string
) {
  const nodes = await comfyPage.nodeOps.getNodeRefsByTitle(nodeTitle)
  if (nodes.length === 0) {
    throw new Error(`No "${nodeTitle}" nodes found`)
  }

  await nodes[0].centerOnNode()
  await nodes[0].click('title')

  await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

  const moreOptionsBtn = comfyPage.page.getByTestId('more-options-button')
  await expect(moreOptionsBtn).toBeVisible()
  await moreOptionsBtn.click()
  await comfyPage.nextFrame()

  const menu = comfyPage.page.locator('.p-contextmenu')
  await expect(menu).toBeVisible()

  return menu
}
