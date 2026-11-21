import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  PACK_RENDERERS,
  PACK_TAGS,
  addPackNode,
  expectPackLoaded,
  keepMixlabOffNodeDrawHooks,
  graphToClient,
  legacyWidgetPoint,
  nodeValue,
  showEmptyGraphAtZoomOne
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const LOAD_VIDEO = 'VHS_LoadVideo'
const UPLOAD_BUTTON = 'choose video to upload'
const VIDEO_ASSET = resolve('browser_tests/assets/plain_video.mp4')

async function videoWidgetValue(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate(
    (id) =>
      window
        .app!.graph.getNodeById(id)!
        .widgets!.find((w) => w.name === 'video')!.value,
    nodeId
  )
}

function previewVideo(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.locator(
    comfyPage.isVueNodes
      ? `[data-node-id="${nodeId}"] .vhs_preview video`
      : '.vhs_preview video'
  )
}

async function loadVideoIntoNode(comfyPage: ComfyPage, nodeId: NodeId) {
  const response = await comfyPage.request.post(
    `${comfyPage.url}/api/upload/image`,
    {
      multipart: {
        image: {
          name: 'n2a_vhs.mp4',
          mimeType: 'video/mp4',
          buffer: readFileSync(VIDEO_ASSET)
        },
        overwrite: 'true',
        type: 'input'
      }
    }
  )
  expect(response.ok(), 'video upload').toBe(true)
  await comfyPage.page.evaluate((id) => {
    const widget = window
      .app!.graph.getNodeById(id)!
      .widgets!.find((w) => w.name === 'video')!
    widget.value = 'n2a_vhs.mp4'
    widget.callback?.('n2a_vhs.mp4')
  }, nodeId)
  await expect
    .poll(() =>
      previewVideo(comfyPage, nodeId).evaluate(
        (video: HTMLVideoElement) => video.videoWidth
      )
    )
    .toBe(128)
}

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
        comfyPage
      }) => {
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
          const width = (await nodeValue(comfyPage, id, [
            'size',
            '0'
          ])) as number
          const button = await legacyWidgetPoint(
            comfyPage,
            id,
            UPLOAD_BUTTON,
            width / 2,
            10
          )
          await comfyPage.page.mouse.click(button.x, button.y)
        }
        await (await chooser).setFiles(VIDEO_ASSET)

        await expect
          .poll(() => videoWidgetValue(comfyPage, id))
          .toBe('plain_video.mp4')
        const video = previewVideo(comfyPage, id)
        await expect(video).toBeVisible()
        await expect
          .poll(() =>
            video.evaluate((element: HTMLVideoElement) => element.videoWidth)
          )
          .toBe(128)
      })

      test('dragging the video preview moves the node', async ({
        comfyPage
      }) => {
        const id = await addPackNode(
          comfyPage,
          LOAD_VIDEO,
          [100, 60],
          [340, 300]
        )
        await loadVideoIntoNode(comfyPage, id)
        const video = previewVideo(comfyPage, id)
        await expect(video).toBeVisible()
        const box = await video.boundingBox()
        if (!box) throw new Error('preview has no box')
        const before = (await nodeValue(comfyPage, id, ['pos'])) as number[]
        const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }

        const { mouse } = comfyPage.page
        await mouse.move(start.x, start.y)
        await mouse.down()
        await mouse.move(start.x + 150, start.y + 80, { steps: 10 })
        await mouse.up()

        await expect(async () => {
          const pos = (await nodeValue(comfyPage, id, ['pos'])) as number[]
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
        await expect
          .poll(async () => (await help.boundingBox())?.x ?? -5000, {
            message: 'help panel moved on screen'
          })
          .toBeGreaterThan(0)
      })
    }
  )
}
