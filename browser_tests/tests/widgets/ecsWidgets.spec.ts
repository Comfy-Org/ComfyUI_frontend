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
      expect(initialInputCount).toBeDefined()

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
            return node?.inputs.find((input) => input.widget?.name === 'seed')
              ?.link
          })
        )
        .not.toBeNull()

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
      const textBox = comfyPage.widgetTextBox
      await textBox.fill('')
      await comfyPage.keyboard.press('Control+s')
      await comfyPage.menu.topbar.getSaveDialog().fill('ecs-cleared-text')
      await comfyPage.keyboard.press('Enter')
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect(comfyPage.menu.topbar.getSaveDialog()).toBeHidden()

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(comfyPage.widgetTextBox).toHaveValue('')
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
      await comfyPage.keyboard.press('Control+s')
      await comfyPage.menu.topbar.getSaveDialog().fill('ecs-combo-selection')
      await comfyPage.keyboard.press('Enter')
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect(comfyPage.menu.topbar.getSaveDialog()).toBeHidden()

      await comfyPage.workflow.reloadAndWaitForApp()

      const reloadedNode = await comfyPage.nodeOps.getNodeRefById(3)
      const reloadedSampler = await reloadedNode.getWidgetByName('sampler_name')
      await expect.poll(() => reloadedSampler.getValue()).toBe('heun')
    })

    test('keeps multiline text with special characters after save and reload', async ({
      comfyPage
    }) => {
      const prompt =
        'first line: [subject]\nsecond line: café & tea\nthird line: <end> #100%'
      await comfyPage.widgetTextBox.fill(prompt)
      await comfyPage.keyboard.press('Control+s')
      await comfyPage.menu.topbar.getSaveDialog().fill('ecs-multiline-text')
      await comfyPage.keyboard.press('Enter')
      await comfyPage.workflow.waitForWorkflowIdle()
      await expect(comfyPage.menu.topbar.getSaveDialog()).toBeHidden()

      await comfyPage.workflow.reloadAndWaitForApp()

      await expect(comfyPage.widgetTextBox).toHaveValue(prompt)
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
