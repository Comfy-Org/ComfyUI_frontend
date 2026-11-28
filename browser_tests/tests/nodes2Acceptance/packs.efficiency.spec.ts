import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  GREEN,
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  dispatchExecuted,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  legacyWidgetPoint,
  nodeScreenRect,
  nodeGeometry,
  padRect,
  showEmptyGraphAtZoomOne,
  uploadSolidImage
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import { contains } from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a2'
import {
  KSAMPLER,
  SEED_BUTTON,
  visibleLoraNameRows,
  setLoraCount,
  previewImageBox
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.efficiency'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `efficiency-nodes-comfyui on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'efficiency-nodes-comfyui')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('LoRA Stacker shows as many LoRA rows as lora_count', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, 'LoRA Stacker', [100, 80])

        for (const count of [3, 1, 6]) {
          await setLoraCount(comfyPage, id, count)
          await expect
            .poll(() => visibleLoraNameRows(comfyPage, id), {
              message: `visible lora_name rows for lora_count ${count}`
            })
            .toBe(count)
        }
      })

      test('KSampler (Efficient) seed button sets the seed to -1', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, KSAMPLER, [100, 80], [360, 500])
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          node.widgets!.find((w) => w.name === 'seed')!.value = 12345
        }, id)

        if (comfyPage.isVueNodes) {
          await comfyPage.vueNodes
            .getNodeLocator(id)
            .getByRole('button', { name: SEED_BUTTON })
            .click()
        } else {
          const {
            size: [width]
          } = await nodeGeometry(comfyPage, id)
          const button = await legacyWidgetPoint(
            comfyPage,
            id,
            SEED_BUTTON,
            width / 2,
            10
          )
          await comfyPage.page.mouse.click(button.x, button.y)
        }

        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              (nodeId) =>
                window
                  .app!.graph.getNodeById(nodeId)!
                  .widgets!.find((w) => w.name === 'seed')!.value,
              id
            )
          )
          .toBe(-1)
      })

      test('KSampler (Efficient) preview from an `executed` gifs output sits inside the node and follows a pan', async ({
        comfyPage,
        comfyFiles
      }) => {
        const filename = await uploadSolidImage(
          comfyPage,
          comfyFiles,
          'n2a_eff_preview.png',
          GREEN,
          [128, 128]
        )
        const id = await addPackNode(comfyPage, KSAMPLER, [100, 80], [360, 500])

        await test.step('deliver a gifs output through an `executed` message', () =>
          dispatchExecuted(comfyPage, id, {
            gifs: [
              { filename, subfolder: '', type: 'input', format: 'image/png' }
            ]
          }))

        const node = await nodeScreenRect(comfyPage, id)
        const preview = await previewImageBox(comfyPage, filename)
        expect(contains(padRect(node, 2), preview), 'preview inside node').toBe(
          true
        )

        await comfyPage.page.evaluate(() => {
          const canvas = window.app!.canvas
          canvas.ds.offset[0] += 250
          canvas.ds.offset[1] += 120
          canvas.setDirty(true, true)
        })

        await expect(async () => {
          const moved = await previewImageBox(comfyPage, filename)
          expect(
            contains(padRect(await nodeScreenRect(comfyPage, id), 2), moved),
            'panned preview inside node'
          ).toBe(true)
          expect(
            moved.x - preview.x,
            'preview follows the pan in x'
          ).toBeCloseTo(250, -1)
          expect(
            moved.y - preview.y,
            'preview follows the pan in y'
          ).toBeCloseTo(120, -1)
        }).toPass({ timeout: 10_000 })
      })
    }
  )
}
