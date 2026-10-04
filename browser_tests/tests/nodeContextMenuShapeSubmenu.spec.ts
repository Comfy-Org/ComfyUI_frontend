import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { openMoreOptionsMenu } from '@e2e/fixtures/utils/selectionToolboxMoreOptions'

test.describe(
  'Node context menu shape submenu (FE-570)',
  { tag: '@ui' },
  () => {
    test.use({
      initialSettings: {
        'Comfy.Canvas.SelectionToolbox': true
      }
    })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    async function expectShapeSubmenuVisible(comfyPage: ComfyPage) {
      const submenu = comfyPage.page
        .getByRole('menu')
        .filter({ hasText: 'Default' })
      await expect(submenu).toBeVisible()
      await expect(submenu).toContainText('Box')
      await expect(submenu).toContainText('Card')

      const submenuBox = await submenu.boundingBox()
      expect(submenuBox).not.toBeNull()
      expect(submenuBox!.width).toBeGreaterThan(0)
      expect(submenuBox!.height).toBeGreaterThan(0)
    }

    test('Shape submenu opens when the menu fits in the viewport', async ({
      comfyPage
    }) => {
      await comfyPage.page.setViewportSize({ width: 1280, height: 900 })
      const menu = await openMoreOptionsMenu(comfyPage, 'KSampler')

      await expect
        .poll(() => menu.evaluate((el) => el.scrollHeight <= el.clientHeight))
        .toBe(true)

      await menu.getByRole('menuitem', { name: 'Shape' }).click()
      await expectShapeSubmenuVisible(comfyPage)
    })

    test('Shape submenu opens even when the menu must scroll', async ({
      comfyPage
    }) => {
      await comfyPage.page.setViewportSize({ width: 1280, height: 600 })
      const menu = await openMoreOptionsMenu(comfyPage, 'KSampler')

      const shapeItem = menu.getByRole('menuitem', { name: 'Shape' })
      await shapeItem.scrollIntoViewIfNeeded()
      await shapeItem.click()
      await expectShapeSubmenuVisible(comfyPage)
    })

    test('Color submenu items render their color swatches', async ({
      comfyPage
    }) => {
      await openMoreOptionsMenu(comfyPage, 'KSampler')
      const submenu = await comfyPage.contextMenu.openColorSubmenu()

      await expect(
        comfyPage.contextMenu.colorSwatch('Blue', submenu)
      ).toBeVisible()
    })
  }
)
