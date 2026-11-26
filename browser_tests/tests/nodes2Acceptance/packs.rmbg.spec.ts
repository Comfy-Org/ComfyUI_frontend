import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  BLUE,
  MAGENTA,
  PACK_RENDERERS,
  PACK_TAGS,
  RED,
  addPackNode,
  countColour,
  dispatchExecuted,
  expectPackLoaded,
  expectSplitColours,
  keepMixlabOffNodeDrawHooks,
  legacyWidgetPoint,
  nodeBodyPoint,
  nodeScreenRect,
  nodeValue,
  nodeGeometry,
  showEmptyGraphAtZoomOne,
  uploadSolidImage
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const COMPARE_VIEW = 'AILab_ImageCompareView'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI-RMBG on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'ComfyUI-RMBG')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Image Compare View shows both run images (`executed` message) and moves the split to the pointer', async ({
        comfyPage,
        comfyFiles
      }) => {
        const imageA = await uploadSolidImage(
          comfyPage,
          comfyFiles,
          'n2a_rmbg_a.png',
          RED,
          [512, 128]
        )
        const imageB = await uploadSolidImage(
          comfyPage,
          comfyFiles,
          'n2a_rmbg_b.png',
          BLUE,
          [512, 128]
        )
        const id = await addPackNode(comfyPage, COMPARE_VIEW, [100, 80])

        await test.step('deliver two images through an `executed` message', () =>
          dispatchExecuted(comfyPage, id, {
            images: [
              {
                filename: imageA,
                subfolder: '',
                type: 'input',
                slot: 1
              },
              {
                filename: imageB,
                subfolder: '',
                type: 'input',
                slot: 2
              }
            ]
          }))

        const area = await nodeScreenRect(comfyPage, id)
        await comfyPage.canvasOps.moveMouseToEmptyArea()
        await expect(async () => {
          expect(
            await countColour(comfyPage, area, RED),
            'image 1'
          ).toBeGreaterThan(5_000)
          expect(
            await countColour(comfyPage, area, BLUE),
            'image 2'
          ).toBeGreaterThan(5_000)
        }).toPass({ timeout: 10_000 })

        const hover = await nodeBodyPoint(comfyPage, id, 0.25, 0.6)
        await comfyPage.page.mouse.move(hover.x, hover.y, { steps: 4 })

        await expect(async () => {
          const split = (await nodeValue(comfyPage, id, [
            '_cmpSplitX'
          ])) as number
          expect(split, 'split follows the pointer').toBeLessThan(0.4)
          const red = await countColour(comfyPage, area, RED)
          const blue = await countColour(comfyPage, area, BLUE)
          expect(red / (red + blue), 'share of image 1').toBeLessThan(0.4)
          expect(red, 'image 1 still shown left of the split').toBeGreaterThan(
            500
          )
        }).toPass({ timeout: 10_000 })
        await expectSplitColours(comfyPage, hover, RED, BLUE)
      })

      test('COLORCODE swatch shows its colour and opens the colour picker on click', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          'AILab_ColorToMask',
          [100, 100],
          [320, 180]
        )
        await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          node.widgets!.find((w) => w.name === 'mask_color')!.value = '#FF00FF'
          window.app!.canvas.setDirty(true, true)
        }, id)
        const area = await nodeScreenRect(comfyPage, id)
        await expect
          .poll(() => countColour(comfyPage, area, MAGENTA, 30), {
            message: 'swatch pixels'
          })
          .toBeGreaterThan(1_500)

        const {
          size: [width]
        } = await nodeGeometry(comfyPage, id)
        const swatch = await legacyWidgetPoint(
          comfyPage,
          id,
          'mask_color',
          width / 2,
          11
        )
        await comfyPage.page.mouse.click(swatch.x, swatch.y)

        await expect(comfyPage.page.locator('.ailab-cp-panel')).toBeVisible()
      })
    }
  )
}
