import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Node context menu shape submenu (FE-570)',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
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

      // Bring the node into the viewport before interacting; the loaded
      // workflow's coordinates are not guaranteed to be on-screen, and a
      // missed title-click silently leaves the selection toolbox hidden,
      // which manifests as a `more-options-button` timeout in CI.
      const nodePos = await ksamplerNodes[0].getPosition()
      const viewportSize = comfyPage.page.viewportSize()!
      await comfyPage.canvasOps.dragAndDrop(
        { x: nodePos.x, y: nodePos.y },
        { x: viewportSize.width / 3, y: viewportSize.height * 0.5 }
      )
      await comfyPage.nextFrame()

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

    async function expectShapePopoverVisible(comfyPage: ComfyPage) {
      // Shape popover renders via PrimeVue Popover (body-appended), so it
      // escapes the context menu's overflow container. We assert by content.
      const popover = comfyPage.page
        .locator('.p-popover')
        .filter({ hasText: 'Round' })
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
      const menu = await openMoreOptions(comfyPage)
      const rootList = menu.locator(':scope > ul')

      // When content fits, the constrain-height fallback must not engage,
      // since overflow-y on the <ul> coerces overflow-x to a non-visible
      // value (CSS spec) and would clip in-tree submenus.
      await expect
        .poll(() => rootList.evaluate((el) => getComputedStyle(el).overflowY))
        .toBe('visible')

      await menu.getByRole('menuitem', { name: 'Shape' }).click()
      await expectShapePopoverVisible(comfyPage)
    })

    test('Shape popover opens even when the menu must scroll', async ({
      comfyPage
    }) => {
      // Force the More Options menu to overflow the viewport. In this state
      // constrainMenuHeight applies overflow-y: auto on the root <ul>, which
      // is exactly the scenario that previously hid the in-tree Shape submenu.
      await comfyPage.page.setViewportSize({ width: 1280, height: 520 })
      const menu = await openMoreOptions(comfyPage)
      const rootList = menu.locator(':scope > ul')

      await expect
        .poll(() =>
          rootList.evaluate((el) => el.scrollHeight > el.clientHeight)
        )
        .toBe(true)

      await menu
        .getByRole('menuitem', { name: 'Shape' })
        .scrollIntoViewIfNeeded()
      await menu.getByRole('menuitem', { name: 'Shape' }).click()
      await expectShapePopoverVisible(comfyPage)
    })
  }
)
