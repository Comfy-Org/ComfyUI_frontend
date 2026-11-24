import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'

const NODE_IDS = ['1', '2', '3']

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
        await expect.poll(() => node.slotEndpointDeviations()).not.toEqual({})
        const deviations = Object.values(await node.slotEndpointDeviations())
        expect(Math.max(...deviations), `node ${id}`).toBeLessThan(1)
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
      await comfyPage.nextFrame()

      const deviations = Object.values(await node.slotEndpointDeviations())
      expect(Math.max(...deviations)).toBeLessThan(1)
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
      await comfyPage.nextFrame()
      for (const id of NODE_IDS) {
        const node = new VueNodeFixture(comfyPage.vueNodes.getNodeLocator(id))
        const deviations = Object.values(await node.slotEndpointDeviations())
        expect(Math.max(...deviations), `node ${id}`).toBeLessThan(1)
      }
    })
  }
)
