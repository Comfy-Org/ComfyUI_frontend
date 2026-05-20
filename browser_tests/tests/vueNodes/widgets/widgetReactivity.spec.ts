import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { TestGraphAccess } from '@e2e/types/globals'

test.describe('Vue Widget Reactivity', { tag: '@vue-nodes' }, () => {
  test('Should display added widgets', async ({ comfyPage }) => {
    const loadCheckpointNode = comfyPage.page.locator(
      'css=[data-testid="node-body-4"] > .lg-node-widgets > div'
    )
    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id['4']
      node.widgets!.push(node.widgets![0])
    })
    await expect(loadCheckpointNode).toHaveCount(2)
    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id['4']
      node.widgets![2] = node.widgets![0]
    })
    await expect(loadCheckpointNode).toHaveCount(3)
    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id['4']
      node.widgets!.splice(0, 0, node.widgets![0])
    })
    await expect(loadCheckpointNode).toHaveCount(4)
  })

  test('Should hide removed widgets', async ({ comfyPage }) => {
    const loadCheckpointNode = comfyPage.page.locator(
      'css=[data-testid="node-body-3"] > .lg-node-widgets > div'
    )
    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id['3']
      node.widgets!.pop()
    })
    await expect(loadCheckpointNode).toHaveCount(5)
    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id['3']
      node.widgets!.length--
    })
    await expect(loadCheckpointNode).toHaveCount(4)
    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id['3']
      node.widgets!.splice(0, 1)
    })
    await expect(loadCheckpointNode).toHaveCount(3)
  })

  test('Can load dynamic combos', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'v1 (legacy)'
    )
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await test.step('Add node with dynamic combo', async () => {
      await comfyPage.page.mouse.dblclick(500, 500, { delay: 5 })
      await comfyPage.searchBox.fillAndSelectFirstNode('Resize Image/Mask')
      await expect(comfyPage.searchBox.input).toBeHidden()
    })

    const widget = comfyPage.vueNodes.getWidgetByName(
      'Resize Image/Mask',
      'resize_type'
    )

    await test.step('Update value of the dynamic combo widget', async () => {
      await widget.click()
      await comfyPage.page.getByRole('searchbox').fill('scale width')
      await comfyPage.page.keyboard.press('ArrowDown')
      await comfyPage.page.keyboard.press('Enter')
      await expect(widget.locator('input')).toBeHidden()
      await expect(widget).toHaveText('scale width')
    })

    await test.step('Swap to a different workflow and back', async () => {
      await comfyPage.menu.topbar.getTab(0).click()
      await expect(widget).toBeHidden()
      await comfyPage.menu.topbar.getTab(1).click()
      await expect(widget).toBeVisible()
    })

    await expect(widget, 'Widget has restored value').toHaveText('scale width')
  })
})
