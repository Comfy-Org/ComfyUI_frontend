import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Node context menu viewport overflow (#10824)',
  { tag: '@ui' },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      // Keep the viewport well below the menu content height so overflow is guaranteed.
      await comfyPage.page.setViewportSize({ width: 1280, height: 520 })
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

      // Drag the KSampler toward the lower-left so the menu has limited space below it.
      const nodePos = await ksamplerNodes[0].getPosition()
      const viewportSize = comfyPage.page.viewportSize()!
      const centerX = viewportSize.width / 3
      const centerY = viewportSize.height * 0.75
      await comfyPage.canvasOps.dragAndDrop(
        { x: nodePos.x, y: nodePos.y },
        { x: centerX, y: centerY }
      )
      await comfyPage.nextFrame()

      await ksamplerNodes[0].click('title')
      await comfyPage.nextFrame()

      await expect(comfyPage.page.locator('.selection-toolbox')).toBeVisible()

      const moreOptionsBtn = comfyPage.page.locator(
        '[data-testid="more-options-button"]'
      )
      await expect(moreOptionsBtn).toBeVisible()
      await moreOptionsBtn.click()
      await comfyPage.nextFrame()

      const menu = comfyPage.page.locator('.p-contextmenu')
      await expect(menu).toBeVisible()

      // Wait for constrainMenuHeight (runs via requestAnimationFrame in onMenuShow)
      await comfyPage.nextFrame()

      return menu
    }

    test('last menu item "Remove" is reachable via scroll', async ({
      comfyPage
    }) => {
      const menu = await openMoreOptions(comfyPage)
      const rootList = menu.locator(':scope > ul')

      await expect
        .poll(
          () => rootList.evaluate((el) => el.scrollHeight > el.clientHeight),
          {
            message:
              'Menu should overflow vertically so this test exercises the viewport clamp'
          }
        )
        .toBe(true)

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
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    })
  }
)
