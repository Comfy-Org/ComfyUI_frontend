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
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  colourCentre,
  countColour,
  nodeScreenRect,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  CHOOSER,
  pauseWithTwoImages,
  selectedImages,
  clickConfirm
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.easyuse'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI-Easy-Use on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'ComfyUI-Easy-Use')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Image Chooser paused in Always Pause (`easyuse-image-choose` event) lets the user pick an image and confirm it', async ({
        comfyPage,
        comfyFiles
      }) => {
        const id = await addPackNode(comfyPage, CHOOSER, [100, 60], [400, 500])
        await pauseWithTwoImages(comfyPage, comfyFiles, id)
        const area = await nodeScreenRect(comfyPage, id)
        await expect(async () => {
          expect(
            await countColour(comfyPage, area, RED),
            'image 1 shown'
          ).toBeGreaterThan(5_000)
          expect(
            await countColour(comfyPage, area, BLUE),
            'image 2 shown'
          ).toBeGreaterThan(5_000)
        }).toPass({ timeout: 10_000 })

        const firstImage = await colourCentre(comfyPage, area, RED)
        await comfyPage.page.mouse.click(firstImage!.x, firstImage!.y)
        await expect.poll(() => selectedImages(comfyPage, id)).toEqual([0])

        const posted = comfyPage.page.waitForRequest(
          (request) =>
            request.url().includes('/easyuse/image_chooser_message') &&
            request.method() === 'POST'
        )
        await clickConfirm(comfyPage, id)

        expect((await posted).postDataJSON()).toMatchObject({
          node_id: id,
          action: 'select',
          selected: [0]
        })
      })
    }
  )
}
