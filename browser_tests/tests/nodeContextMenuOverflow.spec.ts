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

      const menu = comfyPage.page.locator('.p-contextmenu')
      await expect(menu).toBeVisible({ timeout: 3000 })

      return menu
    }

    test('last menu item "Remove" is reachable via scroll', async ({
      comfyPage
    }) => {
      const menu = await openMoreOptions(comfyPage)
      const rootList = menu.locator(':scope > ul')

      const { clientHeight, scrollHeight } = await rootList.evaluate((el) => ({
        clientHeight: el.clientHeight,
        scrollHeight: el.scrollHeight
      }))
      expect(
        scrollHeight,
        'Menu should overflow vertically so this test exercises the viewport clamp'
      ).toBeGreaterThan(clientHeight)

      // "Remove" is the last item in the More Options menu.
      // It must become reachable by scrolling the bounded menu list.
      const removeItem = menu.getByText('Remove', { exact: true })
      const didScroll = await rootList.evaluate((el) => {
        const previousScrollTop = el.scrollTop
        el.scrollTo({ top: el.scrollHeight })
        return el.scrollTop > previousScrollTop
      })
      expect(didScroll).toBe(true)
      await expect(removeItem).toBeVisible()
    })

    test('last menu item "Remove" is clickable and removes the node', async ({
      comfyPage
    }) => {
      const menu = await openMoreOptions(comfyPage)

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
