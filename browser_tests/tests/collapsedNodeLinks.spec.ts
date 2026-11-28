import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import {
  graphItems,
  screenshotRegion
} from '@e2e/fixtures/utils/screenshotRegion'
import {
  assertNodeSlotsWithinBounds,
  measureNodeSlotOffsets
} from '@e2e/fixtures/utils/slotBoundsUtil'

const NODE_ID = '3'
const NODE_TITLE = 'KSampler'

test.describe(
  'Collapsed node link positions',
  { tag: ['@canvas', '@node', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('default')
    })

    test('link endpoints stay within collapsed node bounds', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
    })

    test('collapsed node fits its title and anchors slots on its edges', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      const expanded = await node.boundingBox()
      await node.toggleCollapse()

      await expect
        .poll(async () => (await node.boundingBox())?.width)
        .toBeLessThan((expanded?.width ?? 0) / 2)

      const { nodeW, slots } = (await measureNodeSlotOffsets(
        comfyPage.page,
        NODE_ID
      )) ?? { nodeW: 0, slots: [] }
      expect(slots.length).toBeGreaterThan(1)
      const displacedAnchors = slots
        .map(({ key, offsetX }) => ({
          key,
          offsetX,
          edge: key.includes('-in-') ? 0 : nodeW
        }))
        .filter(({ offsetX, edge }) => Math.abs(offsetX - edge) > 5)
      expect(displacedAnchors, 'Slot anchors off the node edge').toEqual([])
    })

    test('links follow collapsed node after drag', async ({ comfyPage }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await expect.poll(async () => await node.boundingBox()).not.toBeNull()
      const box = await node.boundingBox()
      await comfyPage.page.mouse.move(
        box!.x + box!.width / 2,
        box!.y + box!.height / 2
      )
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(
        box!.x + box!.width / 2 + 200,
        box!.y + box!.height / 2 + 100,
        { steps: 10 }
      )
      await comfyPage.page.mouse.up()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
    })

    test('links recover correct positions after expand', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(NODE_TITLE)
      await node.toggleCollapse()
      await comfyPage.nextFrame()
      await node.toggleCollapse()
      await comfyPage.nextFrame()

      await assertNodeSlotsWithinBounds(comfyPage.page, NODE_ID)
    })
  }
)

test.describe(
  'Collapsed node links inside subgraph on first entry',
  { tag: ['@canvas', '@node', '@vue-nodes', '@subgraph', '@screenshot'] },
  () => {
    test.use({ initialSettings: { 'Comfy.Minimap.Visible': false } })

    test('renders collapsed node links correctly after fitView on first subgraph entry', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-collapsed-node'
      )
      await comfyPage.nextFrame()

      await comfyPage.vueNodes.enterSubgraph('2')

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      const region = await screenshotRegion(
        comfyPage.page,
        [
          ...(await comfyPage.vueNodes.nodes.all()),
          graphItems(comfyPage.page, 'subgraphIO')
        ],
        { padding: 8 }
      )
      await region.expectScreenshot('subgraph-entry-collapsed-node-links.png')
    })
  }
)
