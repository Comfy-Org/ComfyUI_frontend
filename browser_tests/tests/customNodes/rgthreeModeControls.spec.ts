import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

test.describe(
  'rgthree mode controls @custom-nodes',
  { tag: ['@oss', '@node', '@widget', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.nodeOps.clearGraph()
    })

    test.afterEach(async ({ comfyPage }) => {
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
        await test.step('verify custom node registration', async () => {
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
        })

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

        await expect(
          comfyPage.vueNodes.getNodeLocator(String(control.id))
        ).toBeVisible()

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

        await expect(
          comfyPage.vueNodes.getNodeLocator(String(source.id))
        ).toHaveCSS('opacity', '1')
        await comfyPage.page.evaluate((controlId) => {
          window.app!.graph.getNodeById(controlId)!.widgets![0].callback!(
            undefined
          )
        }, control.id)

        await expect(
          comfyPage.vueNodes.getNodeLocator(String(source.id))
        ).toHaveCSS('opacity', '0.5')
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
        await test.step('verify custom node registration', async () => {
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
        })

        const source = await comfyPage.nodeOps.addNode(
          'PrimitiveInt',
          undefined,
          { x: 100, y: 100 }
        )
        const control = await comfyPage.nodeOps.addNode(
          modeControl.type,
          undefined,
          { x: 500, y: 100 }
        )
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

        await expect(
          comfyPage.vueNodes.getNodeLocator(String(control.id))
        ).toBeVisible()

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (controlId) =>
                window.app!.graph.getNodeById(controlId)!.widgets?.[0]?.name,
              control.id
            )
          )
          .toBe('Enable Int')

        const renderedToggle = comfyPage.vueNodes.getWidgetByName(
          modeControl.type,
          'Enable Int'
        )
        await expect(renderedToggle)
          .toBeVisible({ timeout: 2_000 })
          .catch((error: unknown) => {
            expect(error).toMatchObject({
              matcherResult: { name: 'toBeVisible', pass: false }
            })
            test.fail(
              true,
              `${modeControl.type} toggle is not exposed through the Vue Nodes DOM`
            )
            throw error
          })

        const sourceFixture = new VueNodeFixture(
          comfyPage.vueNodes.getNodeLocator(String(source.id))
        )
        await source.centerOnNode()
        await sourceFixture.setTitle('Renamed source')

        const renamedToggle = comfyPage.vueNodes.getWidgetByName(
          modeControl.type,
          'Enable Renamed source'
        )
        await expect(renamedToggle).toBeVisible()

        await expect(
          comfyPage.vueNodes.getNodeLocator(String(source.id))
        ).toHaveCSS('opacity', '1')
        await renamedToggle.click()

        await expect(
          comfyPage.vueNodes.getNodeLocator(String(source.id))
        ).toHaveCSS('opacity', '0.5')
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (sourceId) => window.app!.graph.getNodeById(sourceId)!.mode,
              source.id
            )
          )
          .toBe(modeControl.disabledMode)
      })
    }
  }
)
