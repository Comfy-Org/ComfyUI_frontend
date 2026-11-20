import type { NodeId } from '@comfyorg/graph-model/nodeId'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
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
  nodeValue,
  showEmptyGraphAtZoomOne,
  uploadSolidImage
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const KSAMPLER = 'KSampler (Efficient)'
const SEED_BUTTON = '🎲 Randomize / ♻️ Last Queued Seed'

async function visibleLoraNameRows(comfyPage: ComfyPage, nodeId: NodeId) {
  if (comfyPage.isVueNodes)
    return comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('[data-widget-name^="lora_name_"]:visible')
      .count()
  return comfyPage.page.evaluate(
    (id) =>
      window
        .app!.graph.getNodeById(id)!
        .widgets!.filter(
          (w) =>
            w.name.startsWith('lora_name_') &&
            !w.type.startsWith('tschide') &&
            !w.hidden
        ).length,
    nodeId
  )
}

async function setLoraCount(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  count: number
) {
  await comfyPage.page.evaluate(
    ({ id, count }) => {
      const node = window.app!.graph.getNodeById(id)!
      node.widgets!.find((w) => w.name === 'lora_count')!.value = count
      window.app!.canvas.setDirty(true, true)
    },
    { id: nodeId, count }
  )
}

async function previewImageBox(comfyPage: ComfyPage, filename: string) {
  const image = comfyPage.page.locator(`body > img[src*="${filename}"]`)
  await expect(image).toBeVisible()
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
    .toBe(true)
  const box = await image.boundingBox()
  if (!box) throw new Error('preview image has no box')
  return box
}

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
          const width = (await nodeValue(comfyPage, id, [
            'size',
            '0'
          ])) as number
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
        comfyPage
      }) => {
        const filename = await uploadSolidImage(
          comfyPage,
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
        expect(preview.x, 'preview left').toBeGreaterThanOrEqual(node.x - 2)
        expect(preview.y, 'preview top').toBeGreaterThanOrEqual(node.y - 2)
        expect(preview.x + preview.width, 'preview right').toBeLessThanOrEqual(
          node.x + node.width + 2
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
