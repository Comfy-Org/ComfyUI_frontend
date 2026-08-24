import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
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

  test('Should display widgets in the order of the live widget array', async ({
    comfyPage
  }) => {
    const nodeId = toNodeId(
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (node) => (node.widgets?.length ?? 0) === 1
        )
        if (!node) throw new Error('Node with one widget not found')

        const workflow = node.addWidget('text', 'saola-workflow', '', () => {})
        node.addWidget('text', 'okapi-resolution', '', () => {})

        const element = document.createElement('div')
        element.textContent = 'numbat-stage'
        node.addDOMWidget('numbat-stage', 'numbat-stage', element, {
          serialize: false
        })

        const upload = node.addWidget(
          'button',
          'quoll-upload',
          undefined,
          () => {}
        )
        const link = node.addWidget('button', 'olm-link', undefined, () => {})
        const widgets = node.widgets!
        widgets.splice(widgets.indexOf(upload), 1)
        widgets.splice(widgets.indexOf(workflow) + 1, 0, upload)
        widgets.splice(widgets.indexOf(link), 1)
        widgets.splice(widgets.indexOf(upload) + 1, 0, link)

        return String(node.id)
      })
    )

    await comfyPage.nextFrame()
    const orderedWidgets = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('.lg-node-widget')
      .filter({ hasText: /saola|quoll|olm|okapi|numbat/ })

    await expect(orderedWidgets).toContainText([
      'saola-workflow',
      'quoll-upload',
      'olm-link',
      'okapi-resolution',
      'numbat-stage'
    ])
  })

  test('Should hide removed widgets', async ({ comfyPage }) => {
    const nodeId = toNodeId(
      await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.nodes.find(
          (node) => node.type === 'KSampler'
        )
        if (!node) throw new Error('KSampler node not found')
        return String(node.id)
      })
    )

    const widgets = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('.lg-node-widget')

    await expect.poll(() => widgets.count()).toBeGreaterThanOrEqual(3)
    const initialCount = await widgets.count()
    expect(initialCount).toBeGreaterThanOrEqual(3)
    await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.widgets!.pop()
    }, nodeId)
    await expect(widgets).toHaveCount(initialCount - 1)
    await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.widgets!.length--
    }, nodeId)
    await expect(widgets).toHaveCount(initialCount - 2)
    await comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)
      if (!node) throw new Error(`Node ${nodeId} not found`)
      node.widgets!.splice(0, 1)
    }, nodeId)
    await expect(widgets).toHaveCount(initialCount - 3)
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
