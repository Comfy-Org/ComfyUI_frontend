import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { ComfyPage } from '../fixtures/ComfyPage'

test.describe(
  'Node context menu viewport overflow (#10824)',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
      await comfyPage.settings.setSetting('Comfy.Canvas.SelectionToolbox', true)
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      await comfyPage.nextFrame()
    })

    async function openMoreOptions(comfyPage: ComfyPage) {
      const ksamplerNodes =
        await comfyPage.nodeOps.getNodeRefsByTitle('KSampler')
      if (ksamplerNodes.length === 0) {
        throw new Error('No KSampler nodes found')
      }

      // Drag the KSampler to the center of the screen
      const nodePos = await ksamplerNodes[0].getPosition()
      const viewportSize = comfyPage.page.viewportSize()!
      const centerX = viewportSize.width / 3
      const centerY = viewportSize.height / 2
      await comfyPage.canvasOps.dragAndDrop(
        { x: nodePos.x, y: nodePos.y },
        { x: centerX, y: centerY }
      )
      await comfyPage.nextFrame()

      await ksamplerNodes[0].click('title')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible({
        timeout: 5000
      })

      const moreOptionsBtn = comfyPage.page.locator(
        '[data-testid="more-options-button"]'
      )
      await expect(moreOptionsBtn).toBeVisible({ timeout: 3000 })
      await moreOptionsBtn.click()
      await comfyPage.nextFrame()

      // Retry once if menu didn't open
      const menuVisible = await comfyPage.page
        .locator('.p-contextmenu')
        .isVisible()
        .catch(() => false)
      if (!menuVisible) {
        await moreOptionsBtn.click({ force: true })
        await comfyPage.nextFrame()
      }
    }

    test('context menu has bounded height and is scrollable on desktop', async ({
      comfyPage
    }) => {
      await openMoreOptions(comfyPage)

      const menu = comfyPage.page.locator('.p-contextmenu')
      await expect(menu).toBeVisible({ timeout: 3000 })

      // The root menu list (ul) must have a bounded max-height and
      // scrollable overflow so items beyond the viewport are accessible.
      // The outer div keeps overflow visible so submenus are not clipped.
      const rootList = menu.locator('> ul')
      const styles = await rootList.evaluate((el) => ({
        overflowY: window.getComputedStyle(el).overflowY,
        maxHeight: window.getComputedStyle(el).maxHeight
      }))

      expect(styles.overflowY).toBe('auto')
      expect(styles.maxHeight).not.toBe('none')
    })

    test('last menu item "Remove" is reachable via scroll', async ({
      comfyPage
    }) => {
      await openMoreOptions(comfyPage)

      const menu = comfyPage.page.locator('.p-contextmenu')
      await expect(menu).toBeVisible({ timeout: 3000 })

      // "Remove" is the last item in the More Options menu.
      // It must be scrollable into view even if the menu overflows.
      const removeItem = menu.getByText('Remove', { exact: true })
      await removeItem.scrollIntoViewIfNeeded()
      await expect(removeItem).toBeVisible()
    })

    test('last menu item "Remove" is clickable and removes the node', async ({
      comfyPage
    }) => {
      await openMoreOptions(comfyPage)

      const menu = comfyPage.page.locator('.p-contextmenu')
      await expect(menu).toBeVisible({ timeout: 3000 })

      const removeItem = menu.getByText('Remove', { exact: true })
      await removeItem.scrollIntoViewIfNeeded()
      await removeItem.click()
      await comfyPage.nextFrame()

      // The node should be removed from the graph
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 3000 })
        .toBe(0)
    })
  }
)
