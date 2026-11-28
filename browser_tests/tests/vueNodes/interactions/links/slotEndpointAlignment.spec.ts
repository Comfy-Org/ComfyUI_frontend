import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

const NODE_IDS = ['1', '2', '3']

async function maxEndpointDeviation(node: VueNodeFixture): Promise<number> {
  const deviations = Object.values(await node.slotEndpointDeviations())
  return deviations.length ? Math.max(...deviations) : Infinity
}

test.describe(
  'Vue node slot endpoints',
  { tag: ['@vue-nodes', '@canvas'] },
  () => {
    test.use({ initialSettings: { 'Comfy.Minimap.Visible': false } })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/growable-regions')
    })

    test('link endpoints sit on every slot dot of fixed, content-sized and growable rows', async ({
      comfyPage
    }) => {
      for (const id of NODE_IDS) {
        const node = new VueNodeFixture(comfyPage.vueNodes.getNodeLocator(id))
        await expect
          .poll(() => maxEndpointDeviation(node), { message: `node ${id}` })
          .toBeLessThan(1)
      }
    })

    test('link endpoints follow a widget row the user resized', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const textG = node.widgetRow('text_g')
      const before = await textG.boundingBox()
      await node.dragHandle(node.growableRegionHandle(textG), 0, 80)
      await expect
        .poll(async () => (await textG.boundingBox())?.height)
        .toBeGreaterThan((before?.height ?? 0) + 60)

      await expect.poll(() => maxEndpointDeviation(node)).toBeLessThan(1)
    })

    test('link endpoints stay on every slot dot after undoing and redoing a node move', async ({
      comfyPage,
      comfyMouse
    }) => {
      const nodes = NODE_IDS.map(
        (id) => new VueNodeFixture(comfyPage.vueNodes.getNodeLocator(id))
      )
      await comfyMouse.dragElementBy(nodes[0].header, { x: 60, y: 40 })

      await comfyPage.keyboard.undo()

      for (const [i, node] of nodes.entries()) {
        await expect
          .poll(() => maxEndpointDeviation(node), {
            message: `node ${NODE_IDS[i]} after undo`
          })
          .toBeLessThan(1)
      }

      await comfyPage.keyboard.redo()

      for (const [i, node] of nodes.entries()) {
        await expect
          .poll(() => maxEndpointDeviation(node), {
            message: `node ${NODE_IDS[i]} after redo`
          })
          .toBeLessThan(1)
      }
    })

    test('link endpoints sit on the slot dots of a reroute, whose input has no label', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'links/single_connected_reroute_node'
      )
      const rerouteId = await comfyPage.page.evaluate(() =>
        String(
          window.app!.graph.nodes.find(({ type }) => type === 'Reroute')?.id
        )
      )
      const reroute = new VueNodeFixture(
        comfyPage.vueNodes.getNodeLocator(rerouteId)
      )
      await expect.poll(() => reroute.slotEndpointDeviations()).not.toEqual({})
      const deviations = Object.values(await reroute.slotEndpointDeviations())
      expect(deviations).toHaveLength(2)
      expect(Math.max(...deviations)).toBeLessThan(1)
    })

    test('link endpoints sit on the collapsed slot dots', async ({
      comfyPage
    }) => {
      await comfyPage.keyboard.selectAll()
      await comfyPage.canvas.press('Alt+c')
      await expect(comfyPage.page.locator('[data-collapsed]')).toHaveCount(3)
      for (const id of NODE_IDS) {
        const node = new VueNodeFixture(comfyPage.vueNodes.getNodeLocator(id))
        await expect
          .poll(() => maxEndpointDeviation(node), { message: `node ${id}` })
          .toBeLessThan(1)
      }
    })

    for (const palette of ['classic', 'morning-class']) {
      test.describe(`with the ${palette} theme`, () => {
        test.use({
          initialSettings: {
            'Comfy.Minimap.Visible': false,
            'Comfy.ColorPalette': palette
          }
        })

        test('link endpoints sit on every expanded and collapsed slot dot', async ({
          comfyPage
        }) => {
          await expect(comfyPage.page.locator(':root')).toHaveAttribute(
            'data-theme',
            palette
          )
          const nodes = NODE_IDS.map(
            (id) => new VueNodeFixture(comfyPage.vueNodes.getNodeLocator(id))
          )

          await test.step('expanded', async () => {
            for (const [i, node] of nodes.entries()) {
              await expect
                .poll(() => maxEndpointDeviation(node), {
                  message: `node ${NODE_IDS[i]}`
                })
                .toBeLessThan(1)
            }
          })

          await test.step('collapsed', async () => {
            await comfyPage.keyboard.selectAll()
            await comfyPage.canvas.press('Alt+c')
            await expect(
              comfyPage.page.locator('[data-collapsed]')
            ).toHaveCount(3)
            for (const [i, node] of nodes.entries()) {
              await expect
                .poll(() => maxEndpointDeviation(node), {
                  message: `node ${NODE_IDS[i]}`
                })
                .toBeLessThan(1)
            }
          })
        })
      })
    }

    test.describe('without a header', () => {
      let nodeId: string

      test.beforeEach(async ({ comfyPage }) => {
        nodeId = await comfyPage.page.evaluate(() => {
          const { LiteGraph } = window
          Object.assign(LiteGraph!.registered_node_types.KSampler, {
            title_mode: LiteGraph!.NO_TITLE
          })
          const node = LiteGraph!.createNode('KSampler')!
          node.pos = [100, 400]
          window.app!.graph.add(node)
          return String(node.id)
        })
        await comfyPage.nextFrame()
      })

      test('link endpoints sit on the slot dots of a node without a header', async ({
        comfyPage
      }) => {
        const node = new VueNodeFixture(
          comfyPage.vueNodes.getNodeLocator(nodeId)
        )
        await expect(node.header).toHaveCount(0)
        await expect.poll(() => maxEndpointDeviation(node)).toBeLessThan(1)
      })
    })
  }
)
