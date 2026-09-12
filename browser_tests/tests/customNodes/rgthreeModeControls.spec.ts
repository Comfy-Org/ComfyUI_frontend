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
      test(`${modeControl.type} labels its toggle, tracks renames, and changes the connected node mode`, async ({
        comfyPage
      }) => {
        test.fail(
          true,
          'Known regression #15600: rgthree mode controls do not register/render in the current Nodes 2.0 runtime'
        )
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

        const controlNode = comfyPage.vueNodes.getNodeLocator(
          String(control.id)
        )
        const toggle = controlNode.getByText('Enable PrimitiveInt', {
          exact: true
        })
        await expect(toggle).toBeVisible()

        await comfyPage.page.evaluate((sourceId) => {
          const sourceNode = window.app!.graph.getNodeById(sourceId)!
          sourceNode.title = 'Renamed source'
          sourceNode.setDirtyCanvas(true, true)
        }, source.id)

        await expect(
          controlNode.getByText('Enable Renamed source', { exact: true })
        ).toBeVisible()

        await controlNode.getByRole('checkbox').click()
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
