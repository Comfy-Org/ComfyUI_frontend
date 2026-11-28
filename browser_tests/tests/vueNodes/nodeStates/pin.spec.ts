import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { openContextMenu } from '@e2e/fixtures/utils/contextMenuTestHelpers'

const PIN_HOTKEY = 'p'
const PIN_INDICATOR = '[data-testid="node-pin-indicator"]'

test.describe('Vue Node Pin', { tag: '@vue-nodes' }, () => {
  test('should restore resizing after reloading and unpinning a node', async ({
    comfyPage
  }) => {
    const node = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
    const beforePin = Date.now()

    await test.step('Pin the node and hide its resize controls', async () => {
      await node.select()
      await comfyPage.keyboard.press(PIN_HOTKEY)
      await expect(node.pinIndicator).toBeVisible()
      await expect(node.getResizeHandle('SE')).toBeHidden()
    })

    await test.step('Reload the saved pinned node', async () => {
      await comfyPage.workflow.waitForDraftIndexUpdatedSince(beforePin)
      await comfyPage.workflow.reloadAndWaitForApp()
      await expect(node.pinIndicator).toBeVisible()
      await expect(node.getResizeHandle('SE')).toBeHidden()
    })

    await test.step('Unpin through the menu and resize the node', async () => {
      await openContextMenu(comfyPage, 'KSampler')
      await comfyPage.contextMenu.clickMenuItemExact('Unpin')
      await expect(node.getResizeHandle('SE')).toBeVisible()

      const bounds = await node.boundingBox()
      expect(bounds).not.toBeNull()
      await node.resizeFromCorner('SE', 120, 0)
      await expect
        .poll(async () => (await node.boundingBox())?.width)
        .toBeGreaterThan(bounds?.width ?? 0)
    })
  })

  test('should toggle pin only on selected nodes with hotkey', async ({
    comfyPage
  }) => {
    await comfyPage.page.getByText('Load Checkpoint').click()
    await comfyPage.page.getByText('KSampler').click({ modifiers: ['Control'] })

    const checkpointNode = comfyPage.vueNodes.getNodeByTitle('Load Checkpoint')
    const ksamplerNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
    const unselectedIndicator = comfyPage.vueNodes
      .getNodeByTitle('Empty Latent Image')
      .locator(PIN_INDICATOR)

    await comfyPage.page.keyboard.press(PIN_HOTKEY)
    const pinIndicator1 = checkpointNode.locator(PIN_INDICATOR)
    await expect(pinIndicator1).toBeVisible()
    const pinIndicator2 = ksamplerNode.locator(PIN_INDICATOR)
    await expect(pinIndicator2).toBeVisible()
    await expect(unselectedIndicator).toBeHidden()

    await comfyPage.page.keyboard.press(PIN_HOTKEY)
    await expect(pinIndicator1).toBeHidden()
    await expect(pinIndicator2).toBeHidden()
    await expect(unselectedIndicator).toBeHidden()
  })

  test('should not allow dragging pinned nodes', async ({
    comfyMouse,
    comfyPage
  }) => {
    const checkpointNodeHeader = comfyPage.page.getByText('Load Checkpoint')
    await checkpointNodeHeader.click()
    await comfyPage.page.keyboard.press(PIN_HOTKEY)

    const headerPos = await checkpointNodeHeader.boundingBox()
    if (!headerPos) throw new Error('Failed to get header position')
    await comfyMouse.dragElementBy(checkpointNodeHeader, { x: 256, y: 256 })

    await expect
      .poll(async () => await checkpointNodeHeader.boundingBox())
      .toEqual(headerPos)

    await checkpointNodeHeader.click()
    await comfyPage.page.keyboard.press(PIN_HOTKEY)

    await comfyMouse.dragElementBy(checkpointNodeHeader, { x: 256, y: 256 })

    await expect
      .poll(async () => await checkpointNodeHeader.boundingBox())
      .not.toEqual(headerPos)
  })
})
