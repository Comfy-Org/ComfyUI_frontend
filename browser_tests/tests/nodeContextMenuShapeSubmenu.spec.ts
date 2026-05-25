import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { openMoreOptionsMenu } from '@e2e/fixtures/utils/selectionToolboxMoreOptions'

test.describe(
  'Node context menu shape submenu (FE-570)',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    async function expectShapePopoverVisible(comfyPage: ComfyPage) {
      const popover = comfyPage.page
        .locator('.p-popover')
        .filter({ hasText: 'Default' })
      await expect(popover).toBeVisible()
      await expect(popover).toContainText('Box')
      await expect(popover).toContainText('Card')

      const popoverBox = await popover.boundingBox()
      expect(popoverBox).not.toBeNull()
      expect(popoverBox!.width).toBeGreaterThan(0)
      expect(popoverBox!.height).toBeGreaterThan(0)
    }

    test('Shape popover opens when the menu fits in the viewport', async ({
      comfyPage
    }) => {
      await comfyPage.page.setViewportSize({ width: 1280, height: 900 })
      const menu = await openMoreOptionsMenu(comfyPage, 'KSampler')
      const rootList = menu.locator(':scope > ul')

      await expect
        .poll(() => rootList.evaluate((el) => getComputedStyle(el).overflowY))
        .toBe('visible')

      await menu.getByRole('menuitem', { name: 'Shape' }).click()
      await expectShapePopoverVisible(comfyPage)
    })

    test('Shape popover opens even when the menu must scroll', async ({
      comfyPage
    }) => {
      await comfyPage.page.setViewportSize({ width: 1280, height: 600 })
      const menu = await openMoreOptionsMenu(comfyPage, 'KSampler')

      const shapeItem = menu.getByRole('menuitem', { name: 'Shape' })
      await shapeItem.scrollIntoViewIfNeeded()
      await shapeItem.click()
      await expectShapePopoverVisible(comfyPage)
    })
  }
)
