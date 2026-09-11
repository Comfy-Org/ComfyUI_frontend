import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
  await comfyPage.workflow.setupWorkflowsDirectory({})
})

test.describe(
  'ECS migration: widgets and node state',
  { tag: ['@canvas', '@node', '@widget', '@workflow'] },
  () => {
    test.describe.configure({ timeout: 30_000 })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
      await comfyPage.workflow.setupWorkflowsDirectory({})
    })

    test('converts a widget to a connected input and restores it on disconnect', async ({
      comfyPage
    }) => {
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

      await primitiveNode.delete()

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const node = window.app!.graph.nodes.find(
              (node) => String(node.id) === '2'
            )
            return node?.inputs.find((input) => input.widget?.name === 'seed')
              ?.link
          })
        )
        .toBeNull()
      await expect.poll(() => seedWidget.getValue()).toBe(originalValue)
    })

    test('keeps a cleared text widget empty after save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('inputs/string_input')
      const textBox = comfyPage.vueNodes.getWidgetByName(
        'Node With String Input',
        'string_input'
      )
      await textBox.fill('temporary value')
      await expect(textBox).toHaveValue('temporary value')
      await textBox.fill('')
      await comfyPage.menu.topbar.saveWorkflow('ecs-cleared-text')

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(
        comfyPage.vueNodes.getWidgetByName(
          'Node With String Input',
          'string_input'
        )
      ).toHaveValue('')
    })

    test('keeps a combo selection after save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      const ksamplerNode = await comfyPage.nodeOps.getNodeRefById(3)
      const samplerWidget = await ksamplerNode.getWidgetByName('sampler_name')
      await samplerWidget.click()
      await comfyPage.page
        .getByRole('menuitem', { name: 'heun', exact: true })
        .click()
      await comfyPage.contextMenu.waitForHidden()
      await expect.poll(() => samplerWidget.getValue()).toBe('heun')
      await comfyPage.menu.topbar.saveWorkflow('ecs-combo-selection')

      await comfyPage.workflow.reloadAndWaitForApp()

      const reloadedNode = await comfyPage.nodeOps.getNodeRefById(3)
      const reloadedSampler = await reloadedNode.getWidgetByName('sampler_name')
      await expect.poll(() => reloadedSampler.getValue()).toBe('heun')
    })

    test('keeps multiline text with special characters after save and reload', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow('inputs/string_input')
      const prompt =
        'first line: [subject]\nsecond line: café & tea\nthird line: <end> #100%'
      const textBox = comfyPage.vueNodes.getWidgetByName(
        'Node With String Input',
        'string_input'
      )
      await textBox.fill(prompt)
      await comfyPage.menu.topbar.saveWorkflow('ecs-multiline-text')

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(
        comfyPage.vueNodes.getWidgetByName(
          'Node With String Input',
          'string_input'
        )
      ).toHaveValue(prompt)
    })

    test('prevents dragging a pinned node and allows dragging after unpin', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('nodes/single_ksampler')
      const node = await comfyPage.nodeOps.getNodeRefById(3)
      await node.clickContextMenuOption('Pin')
      await comfyPage.contextMenu.waitForHidden()
      await expect(node).toBePinned()
      await comfyPage.nextFrame()
      const pinnedPosition = await node.getProperty<[number, number]>('pos')

      await node.dragBy({ x: 100, y: 80 })
      await comfyPage.nextFrame()

      await expect
        .poll(() => node.getProperty<[number, number]>('pos'))
        .toEqual(pinnedPosition)
      await node.clickContextMenuOption('Unpin')
      await comfyPage.contextMenu.waitForHidden()
      await expect(node).not.toBePinned()

      await node.dragBy({ x: 100, y: 80 })
      await comfyPage.nextFrame()

      await expect
        .poll(() => node.getProperty<[number, number]>('pos'))
        .not.toEqual(pinnedPosition)
    })
  }
)
