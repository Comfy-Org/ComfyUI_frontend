import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import { PropertiesPanelHelper } from '@e2e/tests/propertiesPanel/PropertiesPanelHelper'

test.describe('Properties panel - Widget actions menu', { tag: '@ui' }, () => {
  let panel: PropertiesPanelHelper

  test.beforeEach(async ({ comfyPage }) => {
    panel = new PropertiesPanelHelper(comfyPage.page)
    await comfyPage.actionbar.propertiesButton.click()
    await expect(panel.root).toBeVisible()
    await comfyPage.nodeOps.selectNodes(['KSampler'])
  })

  test('menu opens when clicking the more button', async ({ comfyPage }) => {
    const moreButton = panel.root
      .getByTestId(TestIds.subgraphEditor.widgetActionsMenuButton)
      .first()
    await expect(moreButton).toBeVisible()
    await moreButton.click()

    const menu = comfyPage.page.getByTestId(TestIds.menu.moreMenuContent)
    await expect(menu).toBeVisible()
    await expect(menu.getByText('Rename')).toBeVisible()
  })

  test('menu items are left-aligned', async ({ comfyPage }) => {
    const moreButton = panel.root
      .getByTestId(TestIds.subgraphEditor.widgetActionsMenuButton)
      .first()
    await moreButton.click()

    const menu = comfyPage.page.getByTestId(TestIds.menu.moreMenuContent)
    await expect(menu).toBeVisible()

    const menuButtons = menu.getByRole('button')
    const count = await menuButtons.count()
    expect(count).toBeGreaterThan(0)

    for (let i = 0; i < count; i++) {
      const button = menuButtons.nth(i)
      await expect
        .poll(() =>
          button.evaluate((el) => {
            const style = getComputedStyle(el)
            return style.justifyContent
          })
        )
        .toBe('flex-start')
    }
  })

  test('menu shows Rename and Favorite actions', async ({ comfyPage }) => {
    const moreButton = panel.root
      .getByTestId(TestIds.subgraphEditor.widgetActionsMenuButton)
      .first()
    await moreButton.click()

    const menu = comfyPage.page.getByTestId(TestIds.menu.moreMenuContent)
    await expect(menu).toBeVisible()
    await expect(menu.getByText('Rename')).toBeVisible()
    await expect(menu.getByText('Favorite')).toBeVisible()
  })

  test('menu closes after clicking an action', async ({ comfyPage }) => {
    const moreButton = panel.root
      .getByTestId(TestIds.subgraphEditor.widgetActionsMenuButton)
      .first()
    await moreButton.click()

    const menu = comfyPage.page.getByTestId(TestIds.menu.moreMenuContent)
    await expect(menu).toBeVisible()

    await menu.getByText('Favorite').click()
    await expect(menu).toBeHidden()
  })
})
