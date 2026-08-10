import { AudioPreview, getWav } from '@e2e/fixtures/components/AudioPreview'
import { VideoPreview } from '@e2e/fixtures/components/VideoPreview'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'

test.describe('linked core media selectors', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.route('**/api/view?**', async (route) => {
      const filename = new URL(route.request().url()).searchParams.get(
        'filename'
      )

      if (filename === 'linked-image.webp') {
        await route.fulfill({
          contentType: 'image/webp',
          path: assetPath('image64x64.webp')
        })
        return
      }
      if (filename === 'linked-video.mp4') {
        await route.fulfill({
          contentType: 'video/mp4',
          path: assetPath('plain_video.mp4')
        })
        return
      }
      if (filename === 'linked-audio.wav') {
        await route.fulfill({
          body: getWav(),
          contentType: 'audio/x-wav'
        })
        return
      }

      await route.fallback()
    })

    await comfyPage.workflow.loadWorkflow('widgets/linked_core_media')
  })

  test('hides local media until each selector is disconnected', async ({
    comfyPage
  }) => {
    const loadImage = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
    const loadVideo = comfyPage.vueNodes.getNodeByTitle('Load Video')
    const loadAudio = comfyPage.vueNodes.getNodeByTitle('Load Audio')
    const videoPreview = new VideoPreview(loadVideo)
    const audioPreview = new AudioPreview(loadAudio)
    const [[loadImageNode], [loadVideoNode], [loadAudioNode]] =
      await Promise.all(
        ['LoadImage', 'LoadVideo', 'LoadAudio'].map((type) =>
          comfyPage.nodeOps.getNodeRefsByType(type)
        )
      )

    await expect(loadImage.imagePreview).toHaveCount(0)
    await expect(videoPreview.preview).toHaveCount(0)
    await expect(audioPreview.audio).toHaveCount(0)

    const contextMenu = comfyPage.page.locator('.p-contextmenu')
    await loadImageNode.centerOnNode()
    await comfyPage.contextMenu.openForVueNode(loadImage.header)
    await expect(contextMenu).toBeVisible()
    await expect(
      contextMenu.getByText('Open Image', { exact: true })
    ).toHaveCount(0)
    await expect(
      contextMenu.getByText('Paste Image', { exact: true })
    ).toHaveCount(0)
    await comfyPage.page.keyboard.press('Escape')

    const mediaNodes = [loadImage.root, loadVideo, loadAudio]
    const linkedHeights = await Promise.all(
      mediaNodes.map(async (node) => (await node.boundingBox())?.height ?? 0)
    )
    expect(
      linkedHeights,
      'Linked media nodes should have measurable fitted heights'
    ).not.toContain(0)

    for (const node of [loadImageNode, loadVideoNode, loadAudioNode]) {
      await (await node.getInput(0)).removeLinks()
    }

    await expect(loadImage.imagePreview).toBeVisible()
    await expect(loadImage.imagePreview.locator('img')).toBeVisible()
    await expect(videoPreview.preview).toBeVisible()
    await expect(videoPreview.video).toBeVisible()
    await expect(audioPreview.play).toBeVisible()

    for (const [index, node] of mediaNodes.entries()) {
      await expect
        .poll(() => node.boundingBox().then((box) => box?.height ?? 0), {
          message: 'Restored local media should grow the fitted node'
        })
        .toBeGreaterThan(linkedHeights[index])
    }

    await loadImageNode.centerOnNode()
    await comfyPage.contextMenu.openForVueNode(loadImage.header)
    await expect(contextMenu).toBeVisible()
    await expect(
      contextMenu.getByText('Open Image', { exact: true })
    ).toBeVisible()
    await expect(
      contextMenu.getByText('Paste Image', { exact: true })
    ).toBeVisible()
  })
})
