import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import type { NodeReference } from '../fixtures/utils/litegraphUtils'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Primitive Node', () => {
  test('@perf Can load with correct size', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'primitive-node-load'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('primitive/primitive_node')
    })

    await expect(comfyPage.canvas).toHaveScreenshot('primitive_node.png')

    await perfMonitor.finishMonitoring(testName)
  })

  // When link is dropped on widget, it should automatically convert the widget
  // to input.
  test('@perf Can connect to widget', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'primitive-node-connect-widget'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('primitive/primitive_node_unconnected')
    })

    let primitiveNode: NodeReference
    let ksamplerNode: NodeReference

    await perfMonitor.measureOperation('get-node-references', async () => {
      primitiveNode = await comfyPage.getNodeRefById(1)
      ksamplerNode = await comfyPage.getNodeRefById(2)
    })

    // Connect the output of the primitive node to the input of first widget of the ksampler node
    await perfMonitor.measureOperation('connect-widget', async () => {
      await primitiveNode!.connectWidget(0, ksamplerNode!, 0)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'primitive_node_connected.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can connect to dom widget', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'primitive-node-connect-dom-widget'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow(
        'primitive/primitive_node_unconnected_dom_widget'
      )
    })

    let primitiveNode: NodeReference
    let clipEncoderNode: NodeReference

    await perfMonitor.measureOperation('get-node-references', async () => {
      primitiveNode = await comfyPage.getNodeRefById(1)
      clipEncoderNode = await comfyPage.getNodeRefById(2)
    })

    await perfMonitor.measureOperation('connect-dom-widget', async () => {
      await primitiveNode!.connectWidget(0, clipEncoderNode!, 0)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'primitive_node_connected_dom_widget.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can connect to static primitive node', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'primitive-node-connect-static'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('primitive/static_primitive_unconnected')
    })

    let primitiveNode: NodeReference
    let ksamplerNode: NodeReference

    await perfMonitor.measureOperation('get-node-references', async () => {
      primitiveNode = await comfyPage.getNodeRefById(1)
      ksamplerNode = await comfyPage.getNodeRefById(2)
    })

    await perfMonitor.measureOperation('connect-static-primitive', async () => {
      await primitiveNode!.connectWidget(0, ksamplerNode!, 0)
    })

    await expect(comfyPage.canvas).toHaveScreenshot(
      'static_primitive_connected.png'
    )

    await perfMonitor.finishMonitoring(testName)
  })

  test('Report missing nodes when connect to missing node', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow(
      'primitive/primitive_node_connect_missing_node'
    )
    // Wait for the element with the .comfy-missing-nodes selector to be visible
    const missingNodesWarning = comfyPage.page.locator('.comfy-missing-nodes')
    await expect(missingNodesWarning).toBeVisible()
  })
})
