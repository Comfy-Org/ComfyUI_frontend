import { expect } from '@playwright/test'

import { toNodeId } from '@/types/nodeId'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import type { NodeReference } from '@e2e/fixtures/utils/litegraphUtils'

test.use({ initialSettings: { 'Comfy.UseNewMenu': 'Disabled' } })

test.describe('Primitive Node', { tag: ['@screenshot', '@node'] }, () => {
  for (const renderer of [
    { name: 'LiteGraph', tag: '@ui' },
    { name: 'Vue', tag: ['@ui', '@vue-nodes'] }
  ]) {
    test.describe(`${renderer.name} renderer`, { tag: renderer.tag }, () => {
      test('widget and socket coexist through connect and disconnect with the connected value', async ({
        comfyPage
      }) => {
        await comfyPage.workflow.loadWorkflow(
          'primitive/primitive_node_unconnected'
        )
        const primitive = await comfyPage.nodeOps.getNodeRefById(1)
        const ksampler = await comfyPage.nodeOps.getNodeRefById(2)
        const seed = await ksampler.getWidgetByName('seed')
        const originalValue = await seed.getValue()
        expect(originalValue).toBe(0)

        await primitive.connectWidget(0, ksampler, 0)
        const primitiveWidget = await primitive.getWidget(0)
        if (renderer.name === 'Vue') {
          const input = comfyPage.vueNodes
            .getNodeLocator(primitive.id)
            .getByRole('spinbutton')
          await input.fill('222')
          await input.press('Tab')
        } else {
          await primitiveWidget.click()
          await comfyPage.nodeOps.fillLegacyWidgetDialog('222')
        }
        expect(await primitiveWidget.getValue()).toBe(222)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              ([nodeId, sourceNodeId]) => {
                const node = window.app!.graph.getNodeById(nodeId)
                return {
                  hasWidget: node?.widgets?.some(
                    (widget) => widget.name === 'seed'
                  ),
                  sourceValue:
                    window.app!.graph.getNodeById(sourceNodeId)?.widgets?.[0]
                      ?.value,
                  widgetValue: node?.widgets?.find(
                    (widget) => widget.name === 'seed'
                  )?.value,
                  socketLink: node?.inputs.find(
                    (input) => input.widget?.name === 'seed'
                  )?.link
                }
              },
              [toNodeId(2), toNodeId(1)] as const
            )
          )
          .toEqual({
            hasWidget: true,
            sourceValue: 222,
            widgetValue: 222,
            socketLink: expect.any(Number)
          })

        const disconnected = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)
          const index = node?.inputs.findIndex(
            (input) => input.widget?.name === 'seed'
          )
          if (!node || index === undefined || index < 0) return false
          return node.disconnectInput(index)
        }, toNodeId(2))
        expect(disconnected).toBe(true)
        await comfyPage.nextFrame()
        await expect.poll(() => seed.getValue()).toBe(222)
        await expect
          .poll(() =>
            comfyPage.page.evaluate((nodeId) => {
              const node = window.app!.graph.getNodeById(nodeId)
              return {
                hasWidget: node?.widgets?.some(
                  (widget) => widget.name === 'seed'
                ),
                socketLink: node?.inputs.find(
                  (input) => input.widget?.name === 'seed'
                )?.link
              }
            }, toNodeId(2))
          )
          .toEqual({ hasWidget: true, socketLink: null })
      })
    })
  }

  test('Can load with correct size', async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('primitive/primitive_node')
    await expect(comfyPage.canvas).toHaveScreenshot('primitive_node.png')
  })

  // When link is dropped on widget, it should automatically convert the widget
  // to input.
  test('Can connect to widget without restoring a stale value', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'primitive/primitive_node_unconnected'
    )
    const primitiveNode: NodeReference =
      await comfyPage.nodeOps.getNodeRefById(1)
    const ksamplerNode: NodeReference =
      await comfyPage.nodeOps.getNodeRefById(2)
    // Connect the output of the primitive node to the input of first widget of the ksampler node
    await primitiveNode.connectWidget(0, ksamplerNode, 0)
    const primitiveWidget = await primitiveNode.getWidget(0)
    expect(await primitiveWidget.getValue()).toBe(0)
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
    await comfyPage.canvasOps.moveMouseToEmptyArea()
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

  test('Preserves combo options with a stale slot locator after refreshing node definitions', async ({
    comfyPage
  }) => {
    async function getPrimitiveComboState() {
      return comfyPage.page.evaluate(() => {
        const primitive = window.app!.graph.nodes.find(
          (node) => node.type === 'PrimitiveNode'
        )
        const widget = primitive?.widgets?.[0]
        const values = widget?.options.values
        return {
          isArray: Array.isArray(values),
          length: Array.isArray(values) ? values.length : 0,
          includesEuler: Array.isArray(values)
            ? values.includes('euler')
            : false,
          value: widget?.value
        }
      })
    }

    await comfyPage.workflow.loadWorkflow(
      'primitive/primitive_combo_sampler_name'
    )

    await expect.poll(getPrimitiveComboState).toMatchObject({
      isArray: true,
      includesEuler: true,
      value: 'euler'
    })
    const before = await getPrimitiveComboState()
    expect(before.length).toBeGreaterThan(0)

    // Simulates a stale slot-widget reference (e.g. left over from a node
    // definition reload) by dropping every field except `name`, then
    // confirms refreshComboInNodes() re-resolves it without losing state.
    async function staleifyPrimitiveOutputWidget() {
      return comfyPage.page.evaluate(() => {
        const primitive = window.app!.graph.nodes.find(
          (node) => node.type === 'PrimitiveNode'
        )
        const output = primitive?.outputs[0]
        if (!output?.widget) throw new Error('Expected primitive output widget')

        output.widget = { name: output.widget.name }
      })
    }

    await staleifyPrimitiveOutputWidget()
    await comfyPage.page.evaluate(() => window.app!.refreshComboInNodes())

    const after = await getPrimitiveComboState()
    expect(after).toMatchObject({
      isArray: true,
      includesEuler: true,
      value: 'euler'
    })
    expect(after.length).toBeGreaterThan(0)
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
})
