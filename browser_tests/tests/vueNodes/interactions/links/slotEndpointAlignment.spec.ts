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

    test('link endpoints sit on the slot dots of a node without a header', async ({
      comfyPage
    }) => {
      const nodeId = await comfyPage.page.evaluate(() => {
        const { LiteGraph } = window
        Object.assign(LiteGraph!.registered_node_types.KSampler, {
          title_mode: LiteGraph!.NO_TITLE
        })
        const node = LiteGraph!.createNode('KSampler')!
        node.pos = [100, 400]
        window.app!.graph.add(node)
        return String(node.id)
      })
      const node = new VueNodeFixture(comfyPage.vueNodes.getNodeLocator(nodeId))
      await expect(node.header).toHaveCount(0)
      await expect.poll(() => maxEndpointDeviation(node)).toBeLessThan(1)
    })
  }
)
