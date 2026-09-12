import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'ECS migration: renderer toggle and zoom rendering',
  { tag: ['@canvas', '@node', '@widget'] },
  () => {
    test.describe.configure({ timeout: 60_000 })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.workflow.loadWorkflow('default')
      await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    test('preserves graph geometry and widget state through a renderer round trip', async ({
      comfyPage,
      comfyMouse
    }) => {
      await comfyPage.workflow.setupWorkflowsDirectory({})
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

      const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
      const initialPosition =
        await kSampler.getProperty<[number, number]>('pos')
      const fixture = await comfyPage.vueNodes.getFixtureByTitle('KSampler')
      await comfyMouse.dragElementBy(fixture.title, { x: 120, y: 80 })
      await expect
        .poll(() => kSampler.getProperty<[number, number]>('pos'))
        .not.toEqual(initialPosition)
      const movedPosition = await kSampler.getProperty<[number, number]>('pos')

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

      await comfyPage.menu.topbar.saveWorkflow('Renderer Round Trip')
      await comfyPage.workflow.reloadAndWaitForApp()
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
          positions: initialGraph.positions.map((node) =>
            String(node.id) === '3'
              ? { ...node, pos: [...movedPosition] }
              : node
          ),
          cfg: 7.5
        })
      await expect(comfyPage.toast.toastErrors).toHaveCount(0)
    })

    test('keeps node and link counts stable across three serialized renderer round trips', async ({
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
        await expect
          .poll(() =>
            comfyPage.page.evaluate(() => ({
              nodes: window.app!.graph.nodes.length,
              links: window.app!.graph.links.size
            }))
          )
          .toEqual(initialCounts)
      }

      await expect(comfyPage.toast.toastErrors).toHaveCount(0)
    })

    for (const { label, scale } of [
      { label: '50%', scale: 0.5 },
      { label: '200%', scale: 2 }
    ]) {
      test(`renders Vue widget labels and titles at ${label} zoom`, async ({
        comfyPage
      }) => {
        await comfyPage.canvasOps.resetView()
        await comfyPage.canvasOps.setScale(scale)
        const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
        await kSampler.centerOnNode()
        await expect
          .poll(() => comfyPage.canvasOps.getScale())
          .toBeCloseTo(scale, 2)

        await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
        await comfyPage.vueNodes.waitForNodes()
        await expect
          .poll(() => comfyPage.canvasOps.getScale())
          .toBeCloseTo(scale, 2)

        const vueNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
        const title = vueNode.getByTestId('node-title')
        await expect(title).toBeVisible()
        await expect(title).toHaveText('KSampler')

        const cfgWidget = comfyPage.vueNodes
          .getWidgetByName('KSampler', 'cfg')
          .first()
        await expect(cfgWidget).toBeVisible()
        await expect(
          comfyPage.vueNodes.getWidgetRowByLabel('KSampler', 'cfg')
        ).toBeVisible()
        const { input } = comfyPage.vueNodes.getInputNumberControls(cfgWidget)
        await input.fill('7.5')
        await input.blur()
        await expect(input).toHaveValue('7.5')
      })
    }
  }
)
