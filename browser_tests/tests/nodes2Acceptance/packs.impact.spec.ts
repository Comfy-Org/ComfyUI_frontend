import type { NodeId } from '@comfyorg/graph-model/nodeId'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  countColour,
  dispatchPackEvent,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  nodeScreenRect,
  padRect,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const ZONE_RED = [162, 58, 58] as const
const PROGRESS_GREEN = [0, 128, 0] as const
const STATUS_TEXT = 'n2a upscaling'

async function zonePixels(comfyPage: ComfyPage, nodeId: NodeId) {
  return countColour(
    comfyPage,
    padRect(await nodeScreenRect(comfyPage, nodeId), 4),
    ZONE_RED,
    6
  )
}

async function areaAboveNode(comfyPage: ComfyPage, nodeId: NodeId) {
  const rect = await nodeScreenRect(comfyPage, nodeId)
  return { x: rect.x - 4, y: rect.y - 40, width: rect.width + 8, height: 44 }
}

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI-Impact-Pack on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'ComfyUI-Impact-Pack')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Mask Rect Area preview draws the area and follows the width widget', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, 'MaskRectArea', [200, 150])
        await expect
          .poll(() => zonePixels(comfyPage, id), {
            message: 'area zone drawn at 50% width'
          })
          .toBeGreaterThan(2_000)
        const halfWidth = await zonePixels(comfyPage, id)

        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          const widget = node.widgets!.find((w) => w.name === 'width')!
          widget.value = 100
          widget.callback?.(100)
          window.app!.canvas.setDirty(true, true)
        }, id)

        await expect(async () => {
          const ratio = (await zonePixels(comfyPage, id)) / halfWidth
          expect(ratio, 'zone area at 100% vs 50% width').toBeGreaterThan(1.6)
          expect(ratio, 'zone area at 100% vs 50% width').toBeLessThan(2.4)
        }).toPass({ timeout: 10_000 })
      })

      test('Iterative upscale shows a progress badge (status from an `impact/update_status` message)', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'IterativeLatentUpscale',
          [200, 200],
          [360, 200]
        )
        const greenBefore = await countColour(
          comfyPage,
          await areaAboveNode(comfyPage, id),
          PROGRESS_GREEN,
          20
        )

        await dispatchPackEvent(comfyPage, 'impact/update_status', {
          node: id,
          progress: 0.5,
          text: STATUS_TEXT
        })

        await expect
          .poll(
            async () => {
              const textShown = comfyPage.isVueNodes
                ? (await comfyPage.page.getByText(STATUS_TEXT).count()) > 0
                : false
              const green =
                (await countColour(
                  comfyPage,
                  await areaAboveNode(comfyPage, id),
                  PROGRESS_GREEN,
                  20
                )) - greenBefore
              return textShown || green > 210
            },
            { message: 'progress badge shown on the node' }
          )
          .toBe(true)
      })
    }
  )
}
