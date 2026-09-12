import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { getGroupTitlePosition } from '@e2e/fixtures/utils/groupHelpers'

test.describe(
  'ECS migration: undo/redo',
  { tag: ['@canvas', '@workflow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.settings.setSetting(
        'Comfy.Workflow.WorkflowTabsPosition',
        'Topbar'
      )
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    for (const vueNodesEnabled of [false, true]) {
      test(`moving a node can be undone and a second redo is a no-op (${vueNodesEnabled ? 'Vue' : 'LiteGraph'})`, async ({
        comfyPage
      }) => {
        await comfyPage.settings.setSetting(
          'Comfy.VueNodes.Enabled',
          vueNodesEnabled
        )
        await comfyPage.workflow.loadWorkflow('default')
        if (vueNodesEnabled) await comfyPage.vueNodes.waitForNodes()
        const node = await comfyPage.nodeOps.getNodeRefById('3')
        const initialPosition = await node.getBounding()

        await node.dragBy({ x: 120, y: 80 })
        await expect.poll(() => node.getBounding()).not.toEqual(initialPosition)
        const movedPosition = await node.getBounding()

        await comfyPage.keyboard.undo()
        await expect.poll(() => node.getBounding()).toEqual(initialPosition)

        await comfyPage.keyboard.redo()
        await expect.poll(() => node.getBounding()).toEqual(movedPosition)
        await comfyPage.keyboard.redo()
        await expect.poll(() => node.getBounding()).toEqual(movedPosition)
        await expect(comfyPage.toast.toastErrors).toHaveCount(0)
      })
    }

    test('moving a group by its title can be undone', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.workflow.loadWorkflow('selection/three-nodes-and-group')
      const initialPosition = await comfyPage.canvasOps.getGroupPosition('Pair')
      const titlePosition = await getGroupTitlePosition(comfyPage, 'Pair')

      await comfyMouse.dragAndDrop(titlePosition, {
        x: titlePosition.x + 100,
        y: titlePosition.y + 60
      })
      await expect
        .poll(() => comfyPage.canvasOps.getGroupPosition('Pair'))
        .not.toEqual(initialPosition)

      await comfyPage.keyboard.undo()
      await expect
        .poll(() => comfyPage.canvasOps.getGroupPosition('Pair'))
        .toEqual(initialPosition)
    })

    for (const vueNodesEnabled of [false, true]) {
      test(
        `changing a widget value can be undone and redone (${vueNodesEnabled ? 'Vue' : 'LiteGraph'})`,
        { tag: ['@widget'] },
        async ({ comfyPage }) => {
          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            vueNodesEnabled
          )
          await comfyPage.workflow.loadWorkflow('default')
          if (vueNodesEnabled) await comfyPage.vueNodes.waitForNodes()
          const node = await comfyPage.nodeOps.getNodeRefById('3')
          const steps = await node.getWidget(2)
          const initialValue = await steps.getValue()

          if (vueNodesEnabled) {
            const widget = comfyPage.vueNodes.getWidgetByName(
              'KSampler',
              'steps'
            )
            const { input } = comfyPage.vueNodes.getInputNumberControls(widget)
            await widget.click()
            await input.fill('31')
            await input.press('Enter')
            await (
              await comfyPage.vueNodes.getFixtureByTitle('KSampler')
            ).title.click()
          } else {
            await steps.dragHorizontal(80)
          }
          await expect.poll(() => steps.getValue()).not.toBe(initialValue)
          const changedValue = await steps.getValue()

          await comfyPage.keyboard.undo()
          await expect.poll(() => steps.getValue()).toBe(initialValue)

          await comfyPage.keyboard.redo()
          await expect.poll(() => steps.getValue()).toBe(changedValue)
        }
      )
    }

    test(
      'three mixed Vue Nodes edits can be undone and redone in order',
      {
        tag: ['@vue-nodes', '@widget']
      },
      async ({ comfyPage, comfyMouse }) => {
        await comfyPage.workflow.loadWorkflow('default')
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
        const node = await comfyPage.nodeOps.getNodeRefById('3')
        const initialPosition = await node.getBounding()
        const ksampler = await comfyPage.vueNodes.getFixtureByTitle('KSampler')

        await comfyMouse.dragElementBy(ksampler.title, { x: 100, y: 50 })
        await expect.poll(() => node.getBounding()).not.toEqual(initialPosition)
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
        const movedPosition = await node.getBounding()

        const stepsWidget = comfyPage.vueNodes.getWidgetByName(
          'KSampler',
          'steps'
        )
        const { input } = comfyPage.vueNodes.getInputNumberControls(stepsWidget)
        const initialSteps = await input.inputValue()
        await stepsWidget.click()
        await input.fill('31')
        await input.press('Enter')
        await expect(input).toHaveValue('31')
        await expect
          .poll(async () => (await node.getWidget(2)).getValue())
          .toBe(31)
        // Leave the editor through a real pointer event before the next edit.
        await ksampler.title.click()
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(2)

        const initialNodeCount = await comfyPage.nodeOps.getGraphNodesCount()
        await comfyPage.searchBoxV2.addNode('Note')
        await expect
          .poll(() => comfyPage.nodeOps.getGraphNodesCount())
          .toBe(initialNodeCount + 1)
        await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(3)

        const expectState = async (
          position: typeof initialPosition,
          steps: string,
          nodeCount: number
        ) => {
          await expect.poll(() => node.getBounding()).toEqual(position)
          await expect(input).toHaveValue(steps)
          await expect
            .poll(() => comfyPage.nodeOps.getGraphNodesCount())
            .toBe(nodeCount)
        }

        await comfyPage.keyboard.undo()
        await expectState(movedPosition, '31', initialNodeCount)
        await comfyPage.keyboard.undo()
        await expectState(movedPosition, initialSteps, initialNodeCount)
        await comfyPage.keyboard.undo()
        await expectState(initialPosition, initialSteps, initialNodeCount)

        await comfyPage.keyboard.redo()
        await expectState(movedPosition, initialSteps, initialNodeCount)
        await comfyPage.keyboard.redo()
        await expectState(movedPosition, '31', initialNodeCount)
        await comfyPage.keyboard.redo()
        await expectState(movedPosition, '31', initialNodeCount + 1)
      }
    )

    test('undo remains scoped to the edited workflow after switching tabs', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.menu.topbar.saveWorkflow('Undo Tab A')
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
      const node = await comfyPage.nodeOps.getNodeRefById('3')
      const initialPosition = await node.getProperty<[number, number]>('pos')

      await node.dragBy({ x: 100, y: 50 })
      await expect
        .poll(() => node.getProperty<[number, number]>('pos'))
        .not.toEqual(initialPosition)
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
      const tabAState = await comfyPage.page.evaluate(() =>
        window
          .app!.graph.nodes.map((graphNode) => ({
            id: String(graphNode.id),
            bounds: [...graphNode.getBounding()]
          }))
          .sort((left, right) => left.id.localeCompare(right.id))
      )

      const tabsBeforeNew = await comfyPage.menu.topbar.getTabNames()
      await comfyPage.menu.topbar.triggerTopbarCommand(['New'])
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      expect(
        await comfyPage.page.evaluate(() =>
          window.app!.graph.nodes.map((graphNode) => String(graphNode.id))
        )
      ).toEqual([])
      const tabsAfterNew = await comfyPage.menu.topbar.getTabNames()
      const newTabs = tabsAfterNew.filter(
        (name) => !tabsBeforeNew.includes(name)
      )
      expect(newTabs, 'New must create exactly one workflow tab').toHaveLength(
        1
      )
      if (newTabs.length !== 1) throw new Error('Expected one new workflow tab')
      const [tabBName] = newTabs
      const tabB = comfyPage.menu.topbar.getWorkflowTab(tabBName)
      await expect(tabB).toBeVisible()

      // Undo in the fresh tab must be a no-op: its queue is empty and it must
      // not reach back into Tab A's history.
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(0)
      await comfyPage.keyboard.undo()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

      await comfyPage.menu.topbar.getWorkflowTab('Undo Tab A').click()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(7)
      await expect
        .poll(() =>
          comfyPage.page.evaluate(() =>
            window
              .app!.graph.nodes.map((graphNode) => ({
                id: String(graphNode.id),
                bounds: [...graphNode.getBounding()]
              }))
              .sort((left, right) => left.id.localeCompare(right.id))
          )
        )
        .toEqual(tabAState)
      await expect.poll(() => comfyPage.workflow.getUndoQueueSize()).toBe(1)
      await expect
        .poll(() => node.getProperty<[number, number]>('pos'))
        .not.toEqual(initialPosition)
      await comfyPage.menu.topbar.triggerTopbarCommand(['Edit', 'Undo'])
      await expect
        .poll(() => node.getProperty<[number, number]>('pos'))
        .toEqual(initialPosition)

      await tabB.click()
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
      expect(
        await comfyPage.page.evaluate(() =>
          window.app!.graph.nodes.map((graphNode) => String(graphNode.id))
        )
      ).toEqual([])
    })
  }
)
