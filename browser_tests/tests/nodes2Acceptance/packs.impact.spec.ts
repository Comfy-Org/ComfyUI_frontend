import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  countColour,
  dispatchPackEvent,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  PROGRESS_GREEN,
  STATUS_TEXT,
  zonePixels,
  areaAboveNode
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.impact'

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

        if (comfyPage.isVueNodes) {
          await expect(
            comfyPage.vueNodes.getNodeLocator(id).getByText(STATUS_TEXT)
          ).toBeVisible()
        } else {
          await expect
            .poll(
              async () =>
                (await countColour(
                  comfyPage,
                  await areaAboveNode(comfyPage, id),
                  PROGRESS_GREEN,
                  20
                )) - greenBefore,
              { message: 'progress badge shown on the node' }
            )
            .toBeGreaterThan(210)
        }
      })
    }
  )
}
