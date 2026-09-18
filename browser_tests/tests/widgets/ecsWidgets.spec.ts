import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.workflow.setupWorkflowsDirectory({})
})

test.describe(
  'ECS migration: widgets and node state',
  { tag: ['@canvas', '@node', '@widget', '@workflow'] },
  () => {
    test.describe.configure({ timeout: 30_000 })
    test.use({
      initialSettings: {
        'Comfy.UseNewMenu': 'Top'
      }
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('converts a widget to a connected input and restores it on disconnect', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.workflow.loadWorkflow(
        'primitive/primitive_node_unconnected'
      )
      const primitiveNode = await comfyPage.nodeOps.getNodeRefById(1)
      const ksamplerNode = await comfyPage.nodeOps.getNodeRefById(2)
      const seedWidget = await ksamplerNode.getWidgetByName('seed')
      const originalValue = await seedWidget.getValue()
      const initialInputCount = await comfyPage.page.evaluate(
        () =>
          window.app!.graph.nodes.find((node) => String(node.id) === '2')
            ?.inputs.length
      )
      expect(
        initialInputCount,
        'KSampler fixture should expose its seed widget input metadata'
      ).toBeDefined()

      await primitiveNode.connectWidget(0, ksamplerNode, 0)

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () =>
              window.app!.graph.nodes.find((node) => String(node.id) === '2')
                ?.inputs.length
          )
        )
        .toBe(initialInputCount)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (node) => String(node.id) === '2'
            )
            return (
              node?.inputs.find((input) => input.widget?.name === 'seed')
                ?.link != null
            )
          })
        )
        .toBe(true)

      await comfyPage.page.evaluate(() => {
        const source = window.app!.graph.nodes.find(
          (node) => String(node.id) === '1'
        )
        if (!source) throw new Error('Primitive source node not found')
        window.app!.graph.remove(source)
      })
      await comfyPage.nextFrame()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (node) => String(node.id) === '2'
            )
            return (
              node?.inputs.find((input) => input.widget?.name === 'seed')
                ?.link == null
            )
          })
        )
        .toBe(true)
      await expect.poll(() => seedWidget.getValue()).toBe(originalValue)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (node) => String(node.id) === '2'
            )
            const widget = node?.widgets?.find(({ name }) => name === 'seed')
            return {
              connectionSuppressed: widget?.connectionSuppressed,
              disabled: widget?.computedDisabled,
              visible: widget ? node?.isWidgetRowVisible(widget) : false
            }
          })
        )
        .toEqual({
          connectionSuppressed: false,
          disabled: false,
          visible: true
        })
    })

    test('keeps multiline text with special characters after save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('widgets/multiline_single_node')
      const prompt =
        'first line: [subject]\nsecond line: café & tea\nthird line: <end> #100%'
      const textBox = comfyPage.vueNodes.getWidgetByName(
        'CLIP Text Encode (Prompt)',
        'text'
      )
      await textBox.fill(prompt)
      await comfyPage.menu.topbar.saveWorkflow('ecs-multiline-text')

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(
        comfyPage.vueNodes.getWidgetByName('CLIP Text Encode (Prompt)', 'text')
      ).toHaveValue(prompt)
    })
  }
)
