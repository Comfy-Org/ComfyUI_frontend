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
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    test.describe('workflow persistence', () => {
      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.setupWorkflowsDirectory({})
      })

      test.afterEach(async ({ comfyPage }) => {
        await comfyPage.workflow.setupWorkflowsDirectory({})
      })

      for (const { startInVue, label } of [
        { startInVue: false, label: 'legacy to Vue to legacy' },
        { startInVue: true, label: 'Vue to legacy to Vue' }
      ]) {
        test(`preserves the complete workflow through ${label}`, async ({
          comfyPage,
          comfyMouse
        }) => {
          const nodeCount = await comfyPage.page.evaluate(
            () => window.app!.graph.nodes.length
          )
          expect(nodeCount).toBeGreaterThan(0)

          if (startInVue) {
            await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
            await comfyPage.vueNodes.waitForNodes(nodeCount)
          }

          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            !startInVue
          )
          if (startInVue) {
            await comfyPage.nextFrame()
            await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
          } else {
            await comfyPage.vueNodes.waitForNodes(nodeCount)
          }

          const kSampler = await comfyPage.nodeOps.getNodeRefById('3')
          const initialPosition =
            await kSampler.getProperty<[number, number]>('pos')
          if (startInVue) {
            await kSampler.dragBy({ x: 120, y: 80 })
            const cfgWidget = await kSampler.getWidgetByName('cfg')
            await cfgWidget.dragHorizontal(-20)
          } else {
            const fixture =
              await comfyPage.vueNodes.getFixtureByTitle('KSampler')
            await comfyMouse.dragElementBy(fixture.title, { x: 120, y: 80 })
            const cfgWidget = comfyPage.vueNodes
              .getWidgetByName('KSampler', 'cfg')
              .first()
            const { input } =
              comfyPage.vueNodes.getInputNumberControls(cfgWidget)
            await input.fill('7.5')
            await input.blur()
            await expect(input).toHaveValue('7.5')
          }
          await expect
            .poll(() => kSampler.getProperty<[number, number]>('pos'))
            .not.toEqual(initialPosition)

          const expectedSerialized =
            await comfyPage.nodeOps.getSerializedGraph()

          await comfyPage.settings.setSetting(
            'Comfy.VueNodes.Enabled',
            startInVue
          )
          if (startInVue) {
            await comfyPage.vueNodes.waitForNodes(nodeCount)
          } else {
            await comfyPage.nextFrame()
            await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
          }

          const expectedRuntime = await comfyPage.page.evaluate(() => {
            const graph = window.app!.graph
            return {
              widgetValues: graph.nodes.map((node) => ({
                id: node.id,
                values: node.widgets?.map((widget) => widget.value) ?? []
              })),
              linkEndpoints: [...graph.links.values()].map((link) => ({
                id: link.id,
                originId: link.origin_id,
                originSlot: link.origin_slot,
                targetId: link.target_id,
                targetSlot: link.target_slot
              }))
            }
          })
          expect(await comfyPage.nodeOps.getSerializedGraph()).toEqual(
            expectedSerialized
          )

          await comfyPage.menu.topbar.saveWorkflow(
            `Renderer Round Trip ${label}`
          )
          await comfyPage.workflow.reloadAndWaitForApp()
          if (startInVue) {
            await comfyPage.vueNodes.waitForNodes(nodeCount)
          } else {
            await expect(comfyPage.vueNodes.nodes).toHaveCount(0)
          }

          await expect
            .poll(() =>
              comfyPage.page.evaluate(() => {
                const graph = window.app!.graph
                return {
                  widgetValues: graph.nodes.map((node) => ({
                    id: node.id,
                    values: node.widgets?.map((widget) => widget.value) ?? []
                  })),
                  linkEndpoints: [...graph.links.values()].map((link) => ({
                    id: link.id,
                    originId: link.origin_id,
                    originSlot: link.origin_slot,
                    targetId: link.target_id,
                    targetSlot: link.target_slot
                  }))
                }
              })
            )
            .toEqual(expectedRuntime)
          expect(await comfyPage.nodeOps.getSerializedGraph()).toEqual(
            expectedSerialized
          )
          await expect(comfyPage.toast.toastErrors).toHaveCount(0)
        })
      }
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
