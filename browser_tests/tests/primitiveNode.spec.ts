import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Primitive Node', { tag: ['@screenshot', '@node'] }, () => {
  test('Can load with correct size', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('primitive/primitive_node')
    await expect(comfyPage.canvas).toHaveScreenshot('primitive_node.png')
  })

  // When link is dropped on widget, it should automatically convert the widget
  // to input.
  test('Can connect to widget', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(
      'primitive/primitive_node_unconnected'
    )
    const primitiveNode: NodeReference =
      await comfyPage.nodeOps.getNodeRefById(1)
    const ksamplerNode: NodeReference =
      await comfyPage.nodeOps.getNodeRefById(2)
    // Connect the output of the primitive node to the input of first widget of the ksampler node
    await primitiveNode.connectWidget(0, ksamplerNode, 0)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'primitive_node_connected.png'
    )
  })

  test('Can connect to dom widget', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(
      'primitive/primitive_node_unconnected_dom_widget'
    )
    const primitiveNode: NodeReference =
      await comfyPage.nodeOps.getNodeRefById(1)
    const clipEncoderNode: NodeReference =
      await comfyPage.nodeOps.getNodeRefById(2)
    await primitiveNode.connectWidget(0, clipEncoderNode, 0)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'primitive_node_connected_dom_widget.png'
    )
  })

  test('Can connect to static primitive node', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow(
      'primitive/static_primitive_unconnected'
    )
    const primitiveNode: NodeReference =
      await comfyPage.nodeOps.getNodeRefById(1)
    const ksamplerNode: NodeReference =
      await comfyPage.nodeOps.getNodeRefById(2)
    await primitiveNode.connectWidget(0, ksamplerNode, 0)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'static_primitive_connected.png'
    )
  })

  test('Report missing nodes when connect to missing node', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.RightSidePanel.ShowErrorsTab',
      true
    )
    await comfyPage.workflow.loadWorkflow(
      'primitive/primitive_node_connect_missing_node'
    )
    const errorOverlay = comfyPage.page.getByTestId(
      TestIds.dialogs.errorOverlay
    )
    await expect(errorOverlay).toBeVisible()
  })

  test('Can serialize to forced inputs @vue-nodes', async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'v1 (legacy)'
    )

    await test.step('Add nodes', async () => {
      await comfyPage.menu.topbar.newWorkflowButton.click()
      await comfyPage.nextFrame()

      await comfyPage.page.mouse.dblclick(250, 500, { delay: 5 })
      await comfyPage.searchBox.fillAndSelectFirstNode('Primitive')
      await expect(comfyPage.searchBox.input).toBeHidden()
      await comfyPage.page.mouse.dblclick(600, 500, { delay: 5 })
      await comfyPage.searchBox.fillAndSelectFirstNode('Node With Force Input')
    })

    const primitive = await comfyPage.vueNodes.getFixtureByTitle('Primitive')
    const node = await comfyPage.vueNodes.getFixtureByTitle(
      'Node With Force Input'
    )

    await test.step('Link nodes', async () => {
      await primitive.getSlot('').dragTo(node.getSlot('int_input').first())
      await expect
        .poll(() => comfyPage.vueNodes.isSlotConnected(primitive.getSlot('')))
        .toBe(true)
    })

    const { input } = comfyPage.vueNodes.getInputNumberControls(
      await comfyPage.vueNodes.getWidgetByName('Primitive', 'value')
    )
    await input.fill('5')
    await input.blur()
    const serializedValue = await comfyPage.page.evaluate(async () => {
      const { output } = await app!.graphToPrompt()
      return output[2].inputs.int_input
    })
    expect(serializedValue, 'Serialized prompt has primitive value').toBe(5)
  })
})
