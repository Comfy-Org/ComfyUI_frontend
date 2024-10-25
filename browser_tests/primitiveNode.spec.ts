import { expect } from '@playwright/test'
import {
  type NodeReference,
  comfyPageFixture as test
} from './fixtures/ComfyPage'

test.describe('Primitive Node', () => {
  test('Can load with correct size', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('primitive_node')
    await expect(comfyPage.canvas).toHaveScreenshot('primitive_node.png')
  })

  // When link is dropped on widget, it should automatically convert the widget
  // to input.
  test('Can connect to widget', async ({ comfyPage }) => {
    await comfyPage.loadWorkflow('primitive_node_unconnected')
    const primitiveNode: NodeReference = await comfyPage.getNodeRefById(1)
    const ksamplerNode: NodeReference = await comfyPage.getNodeRefById(2)
    // Connect the output of the primitive node to the input of first widget of the ksampler node
    await primitiveNode.connectWidget(0, ksamplerNode, 0)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'primitive_node_connected.png'
    )
  })
})
