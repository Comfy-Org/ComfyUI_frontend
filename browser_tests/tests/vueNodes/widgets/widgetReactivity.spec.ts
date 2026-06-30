import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { TestGraphAccess } from '@e2e/types/globals'
import { toNodeId } from '@/types/nodeId'

test.describe('Vue Widget Reactivity', { tag: '@vue-nodes' }, () => {
  test('Should display added widgets', async ({ comfyPage }) => {
    const nodeId = toNodeId(
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (node) => (node.widgets?.length ?? 0) === 1
        )
        if (!node) throw new Error('Node with one widget not found')
        return String(node.id)
      })
    )

    const widgets = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('.lg-node-widget')

    await expect(widgets).toHaveCount(1)
    await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.addWidget('text', 'extra_widget_a', '', () => {})
    }, nodeId)
    await expect(widgets).toHaveCount(2)
    await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.addWidget('text', 'extra_widget_b', '', () => {})
    }, nodeId)
    await expect(widgets).toHaveCount(3)
    await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.addWidget('text', 'extra_widget_c', '', () => {})
    }, nodeId)
    await expect(widgets).toHaveCount(4)
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

  test('Dynamic children have separate state', async ({ comfyPage }) => {
    const nodeName = 'Node With Dynamic Combo'
    await comfyPage.searchBoxV2.addNode(nodeName, {
      position: { x: 200, y: 150 }
    })
    const child = comfyPage.vueNodes.getWidgetByName(nodeName, 'suboption')
    await expect(child, 'initial state').toHaveText('1x')

    await comfyPage.vueNodes.selectComboOption(nodeName, 'combo', 'option2')
    await expect(child, 'child of same name has new state').toHaveText('2x')
  })
})
