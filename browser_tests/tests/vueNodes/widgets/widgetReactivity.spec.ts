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
      node.widgets!.push({ ...node.widgets![0], name: 'added_widget_1' })
    })
    await expect(loadCheckpointNode).toHaveCount(2)
    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id['4']
      node.widgets![2] = { ...node.widgets![0], name: 'added_widget_2' }
    })
    await expect(loadCheckpointNode).toHaveCount(3)
    await comfyPage.page.evaluate(() => {
      const graph = window.graph as TestGraphAccess
      const node = graph._nodes_by_id['4']
      node.widgets!.splice(0, 0, {
        ...node.widgets![0],
        name: 'added_widget_3'
      })
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
    await comfyPage.searchBoxV2.addNode('Resize Image/Mask')
    const widgetTuple = ['Resize Image/Mask', 'resize_type'] as const
    const widget = comfyPage.vueNodes.getWidgetByName(...widgetTuple)

    await test.step('Update value of the dynamic combo widget', async () => {
      await comfyPage.vueNodes.selectComboOption(...widgetTuple, 'scale width')
      await expect(widget).toHaveText('scale width')
    })

    await test.step('Swap to a different workflow and back', async () => {
      await comfyPage.menu.topbar.newWorkflowButton.click()
      await expect(widget).toBeHidden()
      await comfyPage.menu.topbar.getTab(0).click()
      await expect(widget).toBeVisible()
    })

    await expect(widget, 'Widget has restored value').toHaveText('scale width')
  })
})
