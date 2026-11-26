import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  BLUE,
  PACK_RENDERERS,
  PACK_TAGS,
  RED,
  addPackNode,
  countColour,
  dispatchExecuted,
  expectPackLoaded,
  expectSplitColours,
  keepMixlabOffNodeDrawHooks,
  inputImage,
  nodeScreenRect,
  nodeValue,
  showEmptyGraphAtZoomOne,
  uploadSolidImage
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import { nodeLocalPoint } from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a1'

const IMAGES_COMPARE = 'Bjornulf_FourImageViewer'
const IMAGE_LEFT = 10
const IMAGE_TOP = 90

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `Bjornulf_custom_nodes on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await expectPackLoaded(comfyPage, 'Bjornulf_custom_nodes')
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Images Compare (run output delivered by an `executed` message) splits the two images where it is clicked', async ({
        comfyPage,
        comfyFiles
      }) => {
        const imageA = await uploadSolidImage(
          comfyPage,
          comfyFiles,
          'n2a_bjornulf_a.png',
          RED
        )
        const imageB = await uploadSolidImage(
          comfyPage,
          comfyFiles,
          'n2a_bjornulf_b.png',
          BLUE
        )
        const id = await addPackNode(
          comfyPage,
          IMAGES_COMPARE,
          [150, 120],
          [400, 490]
        )
        await dispatchExecuted(comfyPage, id, {
          images_1: [inputImage(imageA)],
          images_2: [inputImage(imageB)]
        })
        await expect
          .poll(async () => {
            const images = await nodeValue(comfyPage, id, ['data', 'images'])
            return Array.isArray(images)
              ? images.filter((image) => image !== null).length
              : 0
          })
          .toBe(2)
        const imageWidth = 400 - 30
        const sliderX = IMAGE_LEFT + imageWidth * 0.8

        const target = await nodeLocalPoint(comfyPage, id, [
          sliderX,
          IMAGE_TOP + 110
        ])
        await comfyPage.page.mouse.click(target.x, target.y)
        await comfyPage.canvasOps.moveMouseToEmptyArea()

        await expect
          .poll(() => nodeValue(comfyPage, id, ['data', 'sliderX']))
          .toBeCloseTo(sliderX, 0)
        const area = await nodeScreenRect(comfyPage, id)
        await expect(async () => {
          const red = await countColour(comfyPage, area, RED)
          const blue = await countColour(comfyPage, area, BLUE)
          expect(red, 'image 1 left of the split').toBeGreaterThan(30_000)
          expect(blue, 'image 2 right of the split').toBeGreaterThan(8_000)
          expect(red / (red + blue), 'share of image 1').toBeGreaterThan(0.7)
          expect(red / (red + blue), 'share of image 1').toBeLessThan(0.9)
        }).toPass({ timeout: 10_000 })
        await expectSplitColours(comfyPage, target, RED, BLUE)
      })
    }
  )
}
