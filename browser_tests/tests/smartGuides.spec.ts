import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

const ANCHOR_LEFT = 50
const NEAR_MISS = { x: -5, y: 60 }

const SNAP_CASES = [
  { enabled: true, expectedLeft: ANCHOR_LEFT },
  { enabled: false, expectedLeft: ANCHOR_LEFT + NEAR_MISS.x }
]

async function draggedNodeLeft(comfyPage: ComfyPage) {
  const [dragged] = await comfyPage.nodeOps.getNodeRefsByTitle('Dragged')
  const [x] = await dragged.getProperty<[number, number]>('pos')
  return x
}

for (const { enabled, expectedLeft } of SNAP_CASES) {
  test.describe(
    `Smart guides ${enabled ? 'enabled' : 'disabled'}`,
    { tag: ['@canvas', '@node'] },
    () => {
      test.use({
        initialSettings: { 'Comfy.Canvas.SmartGuides.Enabled': enabled }
      })

      test.beforeEach(async ({ comfyPage }) => {
        await comfyPage.workflow.loadWorkflow('smartGuides/two_notes')
      })

      test('dragging a node near another node’s left edge', async ({
        comfyPage
      }) => {
        const [dragged] = await comfyPage.nodeOps.getNodeRefsByTitle('Dragged')
        await dragged.dragBy(NEAR_MISS)

        await expect
          .poll(() => draggedNodeLeft(comfyPage))
          .toBeCloseTo(expectedLeft, 0)
      })

      test(
        'dragging a Vue node near another node’s left edge',
        { tag: '@vue-nodes' },
        async ({ comfyPage, comfyMouse }) => {
          const dragged = await comfyPage.vueNodes.getFixtureByTitle('Dragged')
          await comfyMouse.dragElementBy(dragged.header, NEAR_MISS)

          await expect
            .poll(() => draggedNodeLeft(comfyPage))
            .toBeCloseTo(expectedLeft, 0)
        }
      )
    }
  )
}
