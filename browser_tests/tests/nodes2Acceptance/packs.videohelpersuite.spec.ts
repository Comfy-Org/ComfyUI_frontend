import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  graphToClient,
  legacyWidgetPoint,
  nodeGeometry,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  LOAD_VIDEO,
  UPLOAD_BUTTON,
  videoUploadPayload,
  videoWidgetValue,
  previewVideo,
  loadVideoIntoNode
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks.videohelpersuite'

for (const renderer of PACK_RENDERERS) {
  test.describe(
    `ComfyUI-VideoHelperSuite on ${renderer.name}`,
    { tag: [...PACK_TAGS, '@node', ...renderer.tags] },
    () => {
      test.beforeEach(async ({ comfyPage }) => {
        await expectPackLoaded(comfyPage, 'ComfyUI-VideoHelperSuite')
        await keepMixlabOffNodeDrawHooks(comfyPage)
        await showEmptyGraphAtZoomOne(comfyPage)
      })

      test('Load Video upload button uploads the chosen file and shows its preview', async ({
        comfyPage,
        comfyFiles
      }) => {
        const payload = videoUploadPayload(comfyFiles)
        const id = await addPackNode(
          comfyPage,
          LOAD_VIDEO,
          [100, 60],
          [340, 300]
        )
        const chooser = comfyPage.page.waitForEvent('filechooser')
        if (comfyPage.isVueNodes) {
          await comfyPage.vueNodes
            .getNodeLocator(id)
            .getByRole('button', { name: UPLOAD_BUTTON })
            .click()
        } else {
          const {
            size: [width]
          } = await nodeGeometry(comfyPage, id)
          const button = await legacyWidgetPoint(
            comfyPage,
            id,
            UPLOAD_BUTTON,
            width / 2,
            10
          )
          await comfyPage.page.mouse.click(button.x, button.y)
        }
        await (await chooser).setFiles(payload)

        await expect
          .poll(() => videoWidgetValue(comfyPage, id))
          .toBe(payload.name)
        const video = previewVideo(comfyPage, id)
        await expect(video).toBeVisible()
        await expect
          .poll(() =>
            video.evaluate((element: HTMLVideoElement) => element.videoWidth)
          )
          .toBe(128)
      })

      test('dragging the video preview moves the node', async ({
        comfyPage,
        comfyFiles
      }) => {
        const id = await addPackNode(
          comfyPage,
          LOAD_VIDEO,
          [100, 60],
          [340, 300]
        )
        await loadVideoIntoNode(comfyPage, comfyFiles, id)
        const video = previewVideo(comfyPage, id)
        await expect(video).toBeVisible()
        const box = await video.boundingBox()
        if (!box) throw new Error('preview has no box')
        const { pos: before } = await nodeGeometry(comfyPage, id)
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        const { mouse } = comfyPage.page
        await mouse.move(start.x, start.y)
        await mouse.down()
        await mouse.move(start.x + 150, start.y + 80, { steps: 10 })
        await mouse.up()

        await expect(async () => {
          const { pos } = await nodeGeometry(comfyPage, id)
          expect(pos[0] - before[0], 'node moved in x').toBeCloseTo(150, -1)
          expect(pos[1] - before[1], 'node moved in y').toBeCloseTo(80, -1)
        }).toPass({ timeout: 10_000 })
      })

      test('clicking the "?" at the right end of the title opens the node help', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          LOAD_VIDEO,
          [100, 100],
          [340, 300]
        )
        const point = await comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          return [node.pos[0] + node.size[0] - 12, node.pos[1] - 15] as const
        }, id)
        const target = await graphToClient(comfyPage, point)

        await comfyPage.page.mouse.click(target.x, target.y)

        const help = comfyPage.page.locator('.VHS_floatinghelp')
        await expect(help).toContainText('Load Video')
        await expect(help).toBeVisible()
        await expect(help).toBeInViewport()
      })
    }
  )
}
