import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { Rgb } from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  BLUE,
  PACK_RENDERERS,
  PACK_TAGS,
  RED,
  addPackNode,
  countColour,
  expectPackLoaded,
  expectSplitColours,
  keepMixlabOffNodeDrawHooks,
  legacyWidgetPoint,
  nodeScreenRect,
  showEmptyGraphAtZoomOne,
  uploadSolidImage
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  nodeLocalPoint,
  panCanvasY,
  widgetClientTop
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a1'
import {
  widgetValue,
  addImageCompareWithRunOutput,
  comparePanelWidth,
  toggleBounds,
  previewPoint
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.deno'

const IMAGE_COMPARE = 'DenoImageCompare'
const RESIZE_BOX = 'DenoResolutionSetup'
const MULTI_LORA = 'DenoMultiLoraLoader'
const COMPARE_WIDGET = 'deno_image_compare_canvas'
const FIRST_LORA_ROW = 'deno_multi_lora_row_1'
const COMPARE_MODE_BUTTONS_TOP = 72
const DIFFERENCE_OF_RED_AND_BLUE_UNDER_GREEN_TINT: Rgb = [222, 46, 222]
const LORA_TOGGLE_ON: Rgb = [0x88, 0x99, 0xbb]
const CLASSIC_FIRST_LORA_ROW_OFFSET = 109
const CLASSIC_COMPARE_PANEL_OFFSET = 76
const CLASSIC_RESIZE_BOX_WIDGET_SPAN = 120

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `comfyui-deno-custom-nodes on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await expectPackLoaded(comfyPage, 'comfyui-deno-custom-nodes')
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Image Compare (run output delivered by an `executed` message) moves the split to the hovered point', async ({
        comfyPage,
        comfyFiles
      }) => {
        const id = await addImageCompareWithRunOutput(comfyPage, comfyFiles)
        expect(await widgetValue(comfyPage, id, 'split_position')).toBe(0.5)

        const left = await previewPoint(comfyPage, id, 0.2)
        await comfyPage.page.mouse.move(left.x, left.y, { steps: 4 })
        await expect
          .poll(() => widgetValue(comfyPage, id, 'split_position'))
          .toBeCloseTo(0.2, 1)

        const right = await previewPoint(comfyPage, id, 0.8)
        await comfyPage.page.mouse.move(right.x, right.y, { steps: 4 })
        await expect
          .poll(() => widgetValue(comfyPage, id, 'split_position'))
          .toBeCloseTo(0.8, 1)
        const area = await nodeScreenRect(comfyPage, id)
        await expect(async () => {
          const red = await countColour(comfyPage, area, RED)
          const blue = await countColour(comfyPage, area, BLUE)
          expect(red / (red + blue), 'share of image A').toBeGreaterThan(0.7)
          expect(red / (red + blue), 'share of image A').toBeLessThan(0.9)
        }).toPass({ timeout: 10_000 })
        await expectSplitColours(comfyPage, right, RED, BLUE)
      })

      test('Image Compare (run output delivered by an `executed` message) redraws as a difference when Difference is clicked', async ({
        comfyPage,
        comfyFiles
      }) => {
        const id = await addImageCompareWithRunOutput(comfyPage, comfyFiles)
        const panelWidth = await comparePanelWidth(comfyPage, id)
        const buttonWidth = (panelWidth - 28 - 24) / 4
        const difference = await legacyWidgetPoint(
          comfyPage,
          id,
          COMPARE_WIDGET,
          28 + 2 * (buttonWidth + 8) + buttonWidth / 2,
          COMPARE_MODE_BUTTONS_TOP + 16
        )

        await comfyPage.page.mouse.click(difference.x, difference.y)
        await comfyPage.canvasOps.moveMouseToEmptyArea()

        await expect
          .poll(() => widgetValue(comfyPage, id, 'mode'))
          .toBe('Difference')
        await expect
          .poll(
            async () =>
              countColour(
                comfyPage,
                await nodeScreenRect(comfyPage, id),
                DIFFERENCE_OF_RED_AND_BLUE_UNDER_GREEN_TINT,
                30
              ),
            { message: 'difference of image A and image B' }
          )
          .toBeGreaterThan(40_000)
      })

      test('Resize Box crop position moves when the crop box is dragged', async ({
        comfyPage,
        comfyFiles
      }) => {
        const filename = await uploadSolidImage(
          comfyPage,
          comfyFiles,
          'n2a_deno_source.png',
          RED
        )
        const loaderId = await addPackNode(comfyPage, 'LoadImage', [60, 130])
        const id = await addPackNode(comfyPage, RESIZE_BOX, [480, 130])
        await comfyPage.page.evaluate(
          ({ loaderId, id, filename }) => {
            const graph = window.app!.graph
            const loader = graph.getNodeById(loaderId)!
            const box = graph.getNodeById(id)!
            const image = loader.widgets!.find((w) => w.name === 'image')!
            image.value = filename
            image.callback?.(image.value)
            loader.connect(0, box, 'image')
            const method = box.widgets!.find((w) => w.name === 'resize_method')!
            method.value = 'Crop Position (Fill)'
            method.callback?.(method.value)
            window.app!.canvas.setDirty(true, true)
          },
          { loaderId, id, filename }
        )
        expect(await widgetValue(comfyPage, id, 'crop_y')).toBe(0.5)

        await expect
          .poll(
            async () =>
              countColour(comfyPage, await nodeScreenRect(comfyPage, id), RED),
            { message: 'source image drawn in the crop preview' }
          )
          .toBeGreaterThan(4_000)
        const cropRect = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          const preview: {
            cropRect: Record<'x' | 'y' | 'width' | 'height', number>
          } | null = Reflect.get(node, '__denoCropPreview')
          return preview
            ? ([
                preview.cropRect.x + preview.cropRect.width / 2,
                preview.cropRect.y + preview.cropRect.height / 2
              ] as const)
            : null
        }, id)
        expect(cropRect, 'crop box laid out by the preview').not.toBeNull()

        const from = await nodeLocalPoint(comfyPage, id, cropRect!)
        const { mouse } = comfyPage.page
        await mouse.move(from.x, from.y)
        await mouse.down()
        await mouse.move(from.x, from.y + 150, { steps: 8 })
        await mouse.up()

        await expect.poll(() => widgetValue(comfyPage, id, 'crop_y')).toBe(1)
      })

      test('Multi-LoRA row toggle turns the LoRA off and repaints the row', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, MULTI_LORA, [150, 150])
        expect(await widgetValue(comfyPage, id, 'enabled_1')).toBe(true)
        const [x, width] = await toggleBounds(comfyPage, id, FIRST_LORA_ROW)
        await panCanvasY(
          comfyPage,
          await widgetClientTop(comfyPage, id, FIRST_LORA_ROW),
          300
        )
        const rowStart = await legacyWidgetPoint(
          comfyPage,
          id,
          FIRST_LORA_ROW,
          0,
          0
        )
        const row = { x: rowStart.x, y: rowStart.y - 2, width: 120, height: 26 }
        await comfyPage.canvasOps.moveMouseToEmptyArea()
        await expect
          .poll(() => countColour(comfyPage, row, LORA_TOGGLE_ON, 10), {
            message: 'enabled toggle knob'
          })
          .toBeGreaterThan(20)

        const toggle = await legacyWidgetPoint(
          comfyPage,
          id,
          FIRST_LORA_ROW,
          x + width / 2,
          10
        )
        await comfyPage.page.mouse.click(toggle.x, toggle.y)
        await comfyPage.canvasOps.moveMouseToEmptyArea()

        await expect
          .poll(() => widgetValue(comfyPage, id, 'enabled_1'))
          .toBe(false)
        await expect
          .poll(() => countColour(comfyPage, row, LORA_TOGGLE_ON, 10), {
            message: 'row repainted with the knob off'
          })
          .toBe(0)
      })

      test('Multi-LoRA keeps the backend widgets it hides out of the layout', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, MULTI_LORA, [150, 150])
        const nodeTop = (await nodeScreenRect(comfyPage, id)).y

        const rowTop = await widgetClientTop(comfyPage, id, FIRST_LORA_ROW)

        expect(rowTop - nodeTop, 'first LoRA row below the title').toBeLessThan(
          CLASSIC_FIRST_LORA_ROW_OFFSET + 40
        )
      })

      test('Image Compare keeps the backend widgets it hides out of the layout', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, IMAGE_COMPARE, [150, 150])
        const nodeTop = (await nodeScreenRect(comfyPage, id)).y

        const panelTop = await widgetClientTop(comfyPage, id, COMPARE_WIDGET)

        expect(
          panelTop - nodeTop,
          'compare panel below the title'
        ).toBeLessThan(CLASSIC_COMPARE_PANEL_OFFSET + 40)
      })

      test('Resize Box keeps the size widgets it hides in Preset Ratio mode out of the layout', async ({
        comfyPage
      }) => {
        const id = await addPackNode(comfyPage, RESIZE_BOX, [150, 150])
        expect(await widgetValue(comfyPage, id, 'mode')).toBe('Preset Ratio')

        const span =
          (await widgetClientTop(comfyPage, id, 'interpolation')) -
          (await widgetClientTop(comfyPage, id, 'mode'))

        expect(span, 'mode to interpolation rows').toBeLessThan(
          CLASSIC_RESIZE_BOX_WIDGET_SPAN + 30
        )
      })
    }
  )
}
