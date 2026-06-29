import type { Locator } from '@playwright/test'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VideoPreview } from '@e2e/fixtures/components/VideoPreview'
import { assetPath } from '@e2e/fixtures/utils/paths'

const file1 = 'workflow.mp4' as const
const file2 = 'video-preview-wide.webm' as const
const file3 = 'video-preview-square.webm' as const
const file4 = 'video-preview-portrait.webm' as const
const MIN_PREVIEW_FRAME_HEIGHT = 100
const CENTER_TOLERANCE_PX = 1
const videoShapeFixtures = [
  [file2, 'landscape'],
  [file3, 'square'],
  [file4, 'portrait']
] as const

type ThumbnailShape = (typeof videoShapeFixtures)[number][1]

interface VideoPreviewLayout {
  objectFit: string
  objectPosition: string
  wrapperHeight: number
  wrapperWidth: number
  wrapperX: number
  wrapperY: number
  videoBoxHeight: number
  videoBoxWidth: number
  videoIntrinsicHeight: number
  videoIntrinsicWidth: number
  videoX: number
  videoY: number
}

async function readVideoPreviewLayout(
  preview: Locator
): Promise<VideoPreviewLayout | null> {
  return await preview.evaluate((previewElement) => {
    const video = previewElement.querySelector('video')
    const wrapper = video?.parentElement
    if (!(video instanceof HTMLVideoElement) || !wrapper) return null

    const wrapperRect = wrapper.getBoundingClientRect()
    const videoRect = video.getBoundingClientRect()

    return {
      objectFit: getComputedStyle(video).objectFit,
      objectPosition: getComputedStyle(video).objectPosition,
      wrapperHeight: wrapperRect.height,
      wrapperWidth: wrapperRect.width,
      wrapperX: wrapperRect.x,
      wrapperY: wrapperRect.y,
      videoBoxHeight: videoRect.height,
      videoBoxWidth: videoRect.width,
      videoIntrinsicHeight: video.videoHeight,
      videoIntrinsicWidth: video.videoWidth,
      videoX: videoRect.x,
      videoY: videoRect.y
    }
  })
}

async function requireBoundingBox(locator: Locator, subject: string) {
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${subject} should have a bounding box`)

  return box
}

async function expectNodeBoxUnchanged(
  locator: Locator,
  before: { height: number; width: number },
  subject: string
) {
  const after = await requireBoundingBox(locator, subject)
  expect(
    Math.abs(after.width - before.width),
    `${subject} should not change node width`
  ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
  expect(
    Math.abs(after.height - before.height),
    `${subject} should not change node height`
  ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
}

function objectPositionFraction(value: string) {
  if (value.endsWith('%')) return Number.parseFloat(value) / 100

  switch (value) {
    case 'left':
    case 'top':
      return 0
    case 'center':
      return 0.5
    case 'right':
    case 'bottom':
      return 1
    default:
      throw new Error(`Unsupported object-position value: ${value}`)
  }
}

function objectPositionFractions(objectPosition: string) {
  const [x = '50%', y = '50%'] = objectPosition.split(/\s+/)

  return {
    x: objectPositionFraction(x),
    y: objectPositionFraction(y)
  }
}

function getPaintedVideoRect({
  objectPosition,
  videoBoxHeight,
  videoBoxWidth,
  videoIntrinsicHeight,
  videoIntrinsicWidth,
  videoX,
  videoY
}: VideoPreviewLayout) {
  const videoAspectRatio = videoIntrinsicWidth / videoIntrinsicHeight
  const boxAspectRatio = videoBoxWidth / videoBoxHeight
  const paintedWidth =
    videoAspectRatio > boxAspectRatio
      ? videoBoxWidth
      : videoBoxHeight * videoAspectRatio
  const paintedHeight =
    videoAspectRatio > boxAspectRatio
      ? videoBoxWidth / videoAspectRatio
      : videoBoxHeight
  const position = objectPositionFractions(objectPosition)

  return {
    height: paintedHeight,
    width: paintedWidth,
    x: videoX + (videoBoxWidth - paintedWidth) * position.x,
    y: videoY + (videoBoxHeight - paintedHeight) * position.y
  }
}

function expectAspectRatioMatchesShape(
  aspectRatio: number,
  shape: ThumbnailShape
) {
  if (shape === 'landscape') {
    expect(
      aspectRatio,
      'landscape fixture should be wider than tall'
    ).toBeGreaterThan(1)
    return
  }

  if (shape === 'portrait') {
    expect(
      aspectRatio,
      'portrait fixture should be taller than wide'
    ).toBeLessThan(1)
    return
  }

  expect(
    Math.abs(aspectRatio - 1),
    'square fixture should have matching width and height'
  ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX / 100)
}

async function expectCenteredVideoPreview(preview: Locator) {
  await expect
    .poll(async () => {
      const layout = await readVideoPreviewLayout(preview)
      return layout?.videoIntrinsicWidth ?? 0
    })
    .toBeGreaterThan(0)

  const layout = await readVideoPreviewLayout(preview)
  if (!layout) throw new Error('Video preview should render a video element')

  expect(
    layout.wrapperHeight,
    'video preview should keep a usable minimum frame height'
  ).toBeGreaterThanOrEqual(MIN_PREVIEW_FRAME_HEIGHT - CENTER_TOLERANCE_PX)
  expect(layout.videoBoxWidth).toBeGreaterThan(0)
  expect(layout.videoBoxHeight).toBeGreaterThan(0)
  expect(layout.objectFit).toBe('contain')

  const objectPosition = objectPositionFractions(layout.objectPosition)
  expect(objectPosition.x).toBe(0.5)
  expect(objectPosition.y).toBe(0.5)

  const wrapperCenterX = layout.wrapperX + layout.wrapperWidth / 2
  const wrapperCenterY = layout.wrapperY + layout.wrapperHeight / 2
  const paintedVideo = getPaintedVideoRect(layout)
  const paintedVideoCenterX = paintedVideo.x + paintedVideo.width / 2
  const paintedVideoCenterY = paintedVideo.y + paintedVideo.height / 2

  expect(
    Math.abs(paintedVideoCenterX - wrapperCenterX),
    'painted video should be horizontally centered in the preview space'
  ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
  expect(
    Math.abs(paintedVideoCenterY - wrapperCenterY),
    'painted video should be vertically centered in the preview space'
  ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
  expect(layout.videoBoxWidth).toBeLessThanOrEqual(
    layout.wrapperWidth + CENTER_TOLERANCE_PX
  )
  expect(layout.videoBoxHeight).toBeLessThanOrEqual(
    layout.wrapperHeight + CENTER_TOLERANCE_PX
  )
  expect(paintedVideo.width).toBeLessThanOrEqual(
    layout.wrapperWidth + CENTER_TOLERANCE_PX
  )
  expect(paintedVideo.height).toBeLessThanOrEqual(
    layout.wrapperHeight + CENTER_TOLERANCE_PX
  )

  return layout
}

test.describe(
  'VideoPreview',
  { tag: ['@vue-nodes', '@node', '@widget'] },
  () => {
    test('@vue-nodes Load Video', async ({ comfyPage, comfyFiles }) => {
      const loadVideoNode = comfyPage.vueNodes.getNodeByTitle('Load Video')
      const loadVideo = new VideoPreview(loadVideoNode)

      await test.step('Add node', async () => {
        await comfyPage.menu.topbar.newWorkflowButton.click()
        await comfyPage.nextFrame()

        await comfyPage.searchBoxV2.addNode('Load Video')
        await expect(loadVideoNode).toHaveCount(1)
        await expect(loadVideoNode).toBeVisible()
      })

      const loadVideoFixture =
        await comfyPage.vueNodes.getFixtureByTitle('Load Video')

      await test.step('Upload a video file', async () => {
        await loadVideo.upload.setInputFiles(
          assetPath(`workflowInMedia/${file1}`)
        )
        comfyFiles.deleteAfterTest({ filename: file1, type: 'input' })
        await expect(loadVideoNode).toContainText(file1)
        await expect(loadVideo.video).toBeVisible()

        const layout = await expectCenteredVideoPreview(loadVideo.preview)
        expect(layout.videoIntrinsicWidth).toBeGreaterThan(0)
      })

      await test.step('Update displayed video across thumbnail shapes', async () => {
        for (const [filename, shape] of videoShapeFixtures) {
          const initialSrc = await loadVideo.videoSrc()
          const nodeBoxBeforeLoad = await requireBoundingBox(
            loadVideoNode,
            `Load Video node before loading ${filename}`
          )
          await loadVideo.upload.setInputFiles(assetPath(`video/${filename}`))
          comfyFiles.deleteAfterTest({
            filename,
            type: 'input'
          })
          await expect(loadVideoNode).toContainText(filename)
          await expect.poll(() => loadVideo.videoSrc()).not.toEqual(initialSrc)

          const layout = await expectCenteredVideoPreview(loadVideo.preview)
          await expectNodeBoxUnchanged(
            loadVideoNode,
            nodeBoxBeforeLoad,
            `Load Video node after loading ${filename}`
          )
          const updatedVideoAspectRatio =
            layout.videoIntrinsicWidth / layout.videoIntrinsicHeight

          expectAspectRatioMatchesShape(updatedVideoAspectRatio, shape)
        }
      })

      await test.step('Keep video centered after horizontal resize', async () => {
        const nodeBox = await requireBoundingBox(
          loadVideoNode,
          'Load Video node before horizontal resize'
        )
        const initialLayout = await expectCenteredVideoPreview(
          loadVideo.preview
        )

        await loadVideoFixture.resizeFromCorner('SE', 180, 0)
        await comfyPage.nextFrame()
        await expect
          .poll(loadVideoFixture.pollWidth)
          .toBeGreaterThan(nodeBox.width + 100)
        const layout = await expectCenteredVideoPreview(loadVideo.preview)
        expect(
          layout.wrapperWidth - initialLayout.wrapperWidth,
          'video preview space should grow with a wider node'
        ).toBeGreaterThan(100)
        expect(
          Math.abs(layout.wrapperHeight - initialLayout.wrapperHeight),
          'horizontal resize should not change the preview space height'
        ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
      })

      await test.step('Keep video centered after vertical resize', async () => {
        const nodeBox = await requireBoundingBox(
          loadVideoNode,
          'Load Video node before vertical resize'
        )
        const initialLayout = await expectCenteredVideoPreview(
          loadVideo.preview
        )

        await loadVideoFixture.resizeFromCorner('SE', 0, 180)
        await comfyPage.nextFrame()
        await expect
          .poll(loadVideoFixture.pollHeight)
          .toBeGreaterThan(nodeBox.height + 100)
        const layout = await expectCenteredVideoPreview(loadVideo.preview)
        expect(
          layout.wrapperHeight - initialLayout.wrapperHeight,
          'video preview space should grow with a taller node'
        ).toBeGreaterThan(100)
        expect(
          Math.abs(layout.wrapperWidth - initialLayout.wrapperWidth),
          'vertical resize should not change the preview space width'
        ).toBeLessThanOrEqual(CENTER_TOLERANCE_PX)
      })

      await test.step('Display multiple videos', async () => {
        await expect(loadVideo.navigationDots).toBeHidden()

        try {
          await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', false)
          await comfyPage.nextFrame()
          await comfyPage.page.evaluate(
            (names) => {
              graph!.nodes[0].images.splice(
                0,
                1,
                ...names.map((filename) => ({
                  type: 'input',
                  filename,
                  subfolder: ''
                }))
              )
            },
            [file1, file2]
          )
        } finally {
          await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
          await comfyPage.nextFrame()
        }

        await expect(loadVideo.navigationDots).toHaveCount(2)
        await loadVideo.navigationDots.nth(0).press('Enter')
        await expect.poll(() => loadVideo.videoSrc()).toContain(file1)
        await loadVideo.navigationDots.nth(1).press('Enter')
        await expect.poll(() => loadVideo.videoSrc()).toContain(file2)
      })

      await test.step('Can redownload uploaded file', async () => {
        await loadVideo.video.hover()
        await expect(loadVideo.download).toBeVisible()

        const downloadPromise = comfyPage.page.waitForEvent('download')
        await loadVideo.download.click()
        const download = await downloadPromise
        expect(download.suggestedFilename()).toBe(file2)
      })
    })
  }
)
