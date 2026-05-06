import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Node context menu shape submenu (FE-570)',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.page.setViewportSize({ width: 1280, height: 900 })
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
    })

    async function openMoreOptions(comfyPage: ComfyPage) {
      const ksamplerNodes =
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      if (ksamplerNodes.length === 0) {
        throw new Error('No KSampler nodes found')
      }

      await ksamplerNodes[0].click('title')
      await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

      const moreOptionsBtn = comfyPage.page.getByTestId('more-options-button')
      await expect(moreOptionsBtn).toBeVisible()
      await moreOptionsBtn.click()
      await comfyPage.nextFrame()

      const menu = comfyPage.page.locator('.p-contextmenu')
      await expect(menu).toBeVisible()
      await comfyPage.nextFrame()

      return menu
    }

    test('Shape submenu opens to the right of the parent menu without being clipped', async ({
      comfyPage
    }) => {
      const menu = await openMoreOptions(comfyPage)
      const rootList = menu.locator(':scope > ul')

      // When the menu fits in the viewport, the root list must keep
      // overflow-y visible. Setting it to auto/scroll on a <ul> coerces
      // overflow-x to a non-visible value (CSS spec), which produces FE-570.
      await expect
        .poll(() =>
          rootList.evaluate((el) => getComputedStyle(el).overflowY)
        )
        .toBe('visible')

      const shapeItem = menu.getByRole('menuitem', { name: 'Shape' })
      await expect(shapeItem).toBeVisible()
      await shapeItem.hover()

      const shapeSubmenu = shapeItem.locator(':scope > ul')
      await expect(shapeSubmenu).toBeVisible()

      const submenuRect = await shapeSubmenu.boundingBox()
      const parentRect = await rootList.boundingBox()
      expect(submenuRect).not.toBeNull()
      expect(parentRect).not.toBeNull()

      // Submenu must extend horizontally past the parent menu's right edge.
      // If the FE-570 clip is back, the submenu either has zero width or its
      // right edge does not exceed the parent's right edge.
      expect(submenuRect!.width).toBeGreaterThan(0)
      expect(submenuRect!.x + submenuRect!.width).toBeGreaterThan(
        parentRect!.x + parentRect!.width - 1
      )
    })
  }
)
