import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test.describe(
  'rgthree mode controls @custom-nodes',
  { tag: ['@oss', '@node', '@widget'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
      await comfyPage.canvasOps.resetView()
    })

    for (const modeControl of [
      {
        type: 'Fast Muter (rgthree)',
        disabledMode: 2
      },
      {
        type: 'Fast Bypasser (rgthree)',
        disabledMode: 4
      }
    ]) {
      test(`${modeControl.type} control model tracks labels and changes the connected node mode`, async ({
        comfyPage
      }) => {
        await expect
          .poll(
            () =>
              comfyPage.page.evaluate(
                (nodeType) =>
                  Boolean(window.LiteGraph!.registered_node_types[nodeType]),
                modeControl.type
              ),
            {
              message: `${modeControl.type} must register before behavior assertions run`
            }
          )
          .toBe(true)

        const source = await comfyPage.nodeOps.addNode('PrimitiveInt')
        const control = await comfyPage.nodeOps.addNode(modeControl.type)

        await comfyPage.page.evaluate(
          ({ sourceId, controlId }) => {
            const graph = window.app!.graph
            const sourceNode = graph.getNodeById(sourceId)!
            const controlNode = graph.getNodeById(controlId)!
            sourceNode.connect(0, controlNode, 0)
            graph.setDirtyCanvas(true, true)
          },
          { sourceId: source.id, controlId: control.id }
        )
        await comfyPage.nextFrame()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (controlId) =>
                window.app!.graph.getNodeById(controlId)!.widgets?.[0]?.name,
              control.id
            )
          )
          .toBe('Enable Int')

        await comfyPage.page.evaluate((sourceId) => {
          const sourceNode = window.app!.graph.getNodeById(sourceId)!
          sourceNode.title = 'Renamed source'
          sourceNode.setDirtyCanvas(true, true)
        }, source.id)

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (controlId) =>
                window.app!.graph.getNodeById(controlId)!.widgets?.[0]?.name,
              control.id
            )
          )
          .toBe('Enable Renamed source')

        await comfyPage.page.evaluate((controlId) => {
          window.app!.graph.getNodeById(controlId)!.widgets![0].callback!(
            undefined
          )
        }, control.id)
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (sourceId) => window.app!.graph.getNodeById(sourceId)!.mode,
              source.id
            )
          )
          .toBe(modeControl.disabledMode)
      })

      test(`${modeControl.type} exposes its toggle in Vue Nodes`, async ({
        comfyPage
      }) => {
        await expect
          .poll(
            () =>
              comfyPage.page.evaluate(
                (nodeType) =>
                  Boolean(window.LiteGraph!.registered_node_types[nodeType]),
                modeControl.type
              ),
            {
              message: `${modeControl.type} must register before checking its rendered toggle`
            }
          )
          .toBe(true)

        const source = await comfyPage.nodeOps.addNode('PrimitiveInt')
        const control = await comfyPage.nodeOps.addNode(modeControl.type)
        await comfyPage.page.evaluate(
          ({ sourceId, controlId }) => {
            const graph = window.app!.graph
            graph
              .getNodeById(sourceId)!
              .connect(0, graph.getNodeById(controlId), 0)
            graph.setDirtyCanvas(true, true)
          },
          { sourceId: source.id, controlId: control.id }
        )
        await comfyPage.nextFrame()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (controlId) =>
                window.app!.graph.getNodeById(controlId)!.widgets?.[0]?.name,
              control.id
            )
          )
          .toBe('Enable Int')

        test.fail(
          true,
          `${modeControl.type} has no rendered toggle in Vue Nodes`
        )
        const renderedToggle = comfyPage.vueNodes.getWidgetByName(
          modeControl.type,
          'Enable Int'
        )
        await expect(renderedToggle).toBeVisible({ timeout: 2_000 })
        await renderedToggle.click()
      })
    }
  }
)
