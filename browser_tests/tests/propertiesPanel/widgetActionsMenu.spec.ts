import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Properties panel - Widget actions menu', { tag: '@ui' }, () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
    const node = await comfyPage.nodeOps.getNodeRefByTitle('KSampler')
    await node.centerOnNode()
    await node.click('title')
    await expect(panel.panelTitle).toHaveText('KSampler')
  })

  test('menu opens when clicking the more button', async () => {
    const moreButton = panel.widgetActionsButtons.first()
    await expect(moreButton).toBeVisible()
    await moreButton.click()

    const menu = panel.widgetActionsMenu
    await expect(menu).toBeVisible()
    await expect(panel.widgetAction('Rename')).toBeVisible()
  })

  test('menu items are left-aligned', async () => {
    const moreButton = panel.widgetActionsButtons.first()
    await moreButton.click()

    const menu = panel.widgetActionsMenu
    await expect(menu).toBeVisible()

    await expect
      .poll(async () =>
        Math.abs(
          (await panel.widgetActionLabelLeft('Rename')) -
            (await panel.widgetActionLabelLeft('Favorite'))
        )
      )
      .toBeLessThan(1)
  })

  test('menu shows Rename and Favorite actions', async () => {
    const moreButton = panel.widgetActionsButtons.first()
    await moreButton.click()

    const menu = panel.widgetActionsMenu
    await expect(menu).toBeVisible()
    await expect(panel.widgetAction('Rename')).toBeVisible()
    await expect(panel.widgetAction('Favorite')).toBeVisible()
  })

  test('menu closes after clicking an action', async () => {
    const moreButton = panel.widgetActionsButtons.first()
    await moreButton.click()

    const menu = panel.widgetActionsMenu
    await expect(menu).toBeVisible()

    await panel.widgetAction('Favorite').click()
    await expect(menu).toBeHidden()
  })
})
