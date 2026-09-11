import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'ECS migration: renderer toggle and zoom legibility',
  { tag: ['@canvas', '@node', '@vue-nodes', '@widget'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.workflow.loadWorkflow('default')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    test('preserves graph geometry and widget state through a renderer round trip', async ({
      comfyPage
    }) => {
      const initialGraph = await comfyPage.page.evaluate(() => ({
        nodeCount: window.app!.graph.nodes.length,
        positions: window.app!.graph.nodes.map((node) => ({
          id: node.id,
          pos: [...node.pos]
        })),
        cfg: window
          .app!.graph.nodes.find((node) => String(node.id) === '3')
          ?.widgets?.find((widget) => widget.name === 'cfg')?.value
      }))
      expect(initialGraph.nodeCount).toBeGreaterThan(0)
      expect(
        initialGraph.cfg,
        'default workflow must expose KSampler cfg'
      ).toBe(8)

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes(initialGraph.nodeCount)
      await expect(comfyPage.vueNodes.nodes).toHaveCount(initialGraph.nodeCount)

      const cfgWidget = comfyPage.vueNodes
        .getWidgetByName('KSampler', 'cfg')
        .first()
      const { input } = comfyPage.vueNodes.getInputNumberControls(cfgWidget)
      await input.fill('7.5')
      await input.blur()
      await expect(input).toHaveValue('7.5')

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.nextFrame()
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => ({
            nodeCount: window.app!.graph.nodes.length,
            positions: window.app!.graph.nodes.map((node) => ({
              id: node.id,
              pos: [...node.pos]
            })),
            cfg: window
              .app!.graph.nodes.find((node) => String(node.id) === '3')
              ?.widgets?.find((widget) => widget.name === 'cfg')?.value
          }))
        )
        .toEqual({
          nodeCount: initialGraph.nodeCount,
          positions: initialGraph.positions,
          cfg: 7.5
        })
      await expect(comfyPage.toast.toastErrors).toHaveCount(0)
    })

    test('keeps node and link counts stable across three rapid renderer toggles', async ({
      comfyPage
    }) => {
      const initialCounts = await comfyPage.page.evaluate(() => ({
        nodes: window.app!.graph.nodes.length,
        links: window.app!.graph.links.size
      }))

      for (let toggle = 0; toggle < 3; toggle++) {
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes(initialCounts.nodes)
        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
        await comfyPage.nextFrame()
        await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
      }

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => ({
            nodes: window.app!.graph.nodes.length,
            links: window.app!.graph.links.size
          }))
        )
        .toEqual(initialCounts)
      await expect(comfyPage.toast.toastErrors).toHaveCount(0)
    })

    test('keeps widgets interactive and Vue node titles legible at 50% zoom', async ({
      comfyPage
    }) => {
      await comfyPage.canvasOps.resetView()
      await comfyPage.canvasOps.setScale(0.5)
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.centerOnNode(
          window.app!.graph.nodes.find((node) => String(node.id) === '3')!
        )
      })
      await comfyPage.nextFrame()
      await expect
        .poll(() => comfyPage.canvasOps.getScale())
        .toBeCloseTo(0.5, 2)

      const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
      const controlWidget = await kSampler.getWidgetByName(
        'control_after_generate'
      )
      await controlWidget.click()
      await comfyPage.page.getByRole('menuitem', { name: 'fixed' }).click()
      await expect.poll(() => controlWidget.getValue()).toBe('fixed')

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()
      const title = comfyPage.vueNodes
        .getNodeByTitle('KSampler')
        .getByTestId('node-title')
      await expect(title).toBeVisible()
      await expect(title).not.toHaveText('')
    })

    test('keeps widgets interactive and Vue node titles legible at 200% zoom', async ({
      comfyPage
    }) => {
      await comfyPage.canvasOps.resetView()
      await comfyPage.canvasOps.setScale(2)
      await comfyPage.page.evaluate(() => {
        window.app!.canvas.centerOnNode(
          window.app!.graph.nodes.find((node) => String(node.id) === '3')!
        )
      })
      await comfyPage.nextFrame()
      await expect.poll(() => comfyPage.canvasOps.getScale()).toBeCloseTo(2, 2)

      const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
      const controlWidget = await kSampler.getWidgetByName(
        'control_after_generate'
      )
      await controlWidget.click()
      await comfyPage.page.getByRole('menuitem', { name: 'fixed' }).click()
      await expect.poll(() => controlWidget.getValue()).toBe('fixed')

      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.vueNodes.waitForNodes()
      const title = comfyPage.vueNodes
        .getNodeByTitle('KSampler')
        .getByTestId('node-title')
      await expect(title).toBeVisible()
      await expect(title).not.toHaveText('')
    })
  }
)
