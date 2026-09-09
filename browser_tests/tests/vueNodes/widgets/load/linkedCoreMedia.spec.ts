import { AudioPreview, getWav } from '@e2e/fixtures/components/AudioPreview'
import { VideoPreview } from '@e2e/fixtures/components/VideoPreview'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

const linkedImageActionCases = [
  { nodeType: 'LoadImageMask', title: 'Load Image (as Mask)' },
  { nodeType: 'LoadImageOutput', title: 'Load Image (from Outputs)' }
] as const

const imageActionNames = ['Open Image', 'Paste Image'] as const

test.describe('linked core media selectors', { tag: '@vue-nodes' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.page.route('**/internal/files/output**', async (route) => {
      if (route.request().method().toUpperCase() !== 'GET') {
        await route.fallback()
        return
      }

      await route.fulfill({ json: ['linked-image.webp [output]'] })
    })

    await mockViewFiles(comfyPage.page, {
      'linked-image.webp': {
        contentType: 'image/webp',
        path: assetPath('image64x64.webp')
      },
      'linked-image.webp [output]': {
        contentType: 'image/webp',
        path: assetPath('image64x64.webp')
      },
      'linked-video.mp4': {
        contentType: 'video/mp4',
        path: assetPath('plain_video.mp4')
      },
      'linked-audio.wav': {
        body: getWav(),
        contentType: 'audio/x-wav'
      }
    })

    await comfyPage.workflow.loadWorkflow('widgets/linked_core_media')
  })

  test('hides local media until each selector is disconnected', async ({
    comfyPage
  }) => {
    const loadImage = await comfyPage.vueNodes.getFixtureByTitle(/^Load Image$/)
    const loadImageMask = await comfyPage.vueNodes.getFixtureByTitle(
      'Load Image (as Mask)'
    )
    const loadImageOutput = await comfyPage.vueNodes.getFixtureByTitle(
      'Load Image (from Outputs)'
    )
    const loadVideo = comfyPage.vueNodes.getNodeByTitle('Load Video')
    const loadAudio = comfyPage.vueNodes.getNodeByTitle('Load Audio')
    const videoPreview = new VideoPreview(loadVideo)
    const audioPreview = new AudioPreview(loadAudio)
    const [
      [loadImageNode],
      [loadImageMaskNode],
      [loadImageOutputNode],
      [loadVideoNode],
      [loadAudioNode]
    ] = await Promise.all(
      [
        'LoadImage',
        'LoadImageMask',
        'LoadImageOutput',
        'LoadVideo',
        'LoadAudio'
      ].map((type) => comfyPage.nodeOps.getNodeRefsByType(type))
    )

    const imageLoaders = [
      { fixture: loadImage, node: loadImageNode },
      { fixture: loadImageMask, node: loadImageMaskNode },
      { fixture: loadImageOutput, node: loadImageOutputNode }
    ]

    const contextMenu = comfyPage.page.locator('.p-contextmenu')

    await test.step('hide local media for all linked core loaders', async () => {
      for (const { fixture } of imageLoaders) {
        await expect(fixture.imagePreview).toHaveCount(0)
      }
      await expect(videoPreview.preview).toHaveCount(0)
      await expect(audioPreview.audio).toHaveCount(0)
    })

    await test.step('hide linked Load Image actions', async () => {
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
    })

    await test.step('restore local media for all disconnected core loaders', async () => {
      for (const node of [
        ...imageLoaders.map(({ node }) => node),
        loadVideoNode,
        loadAudioNode
      ]) {
        await (await node.getInput(0)).removeLinks()
      }

      for (const { fixture } of imageLoaders) {
        await expect(fixture.imagePreview).toBeVisible()
        await expect(fixture.imagePreview.locator('img')).toBeVisible()
      }
      await expect(videoPreview.preview).toBeVisible()
      await expect(videoPreview.video).toBeVisible()
      await expect(audioPreview.play).toBeVisible()
    })

    await test.step('restore disconnected Load Image actions', async () => {
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

  for (const { nodeType, title } of linkedImageActionCases) {
    test(`hides linked ${title} actions`, async ({ comfyPage }) => {
      const fixture = await comfyPage.vueNodes.getFixtureByTitle(title)
      const [node] = await comfyPage.nodeOps.getNodeRefsByType(nodeType)

      await node.centerOnNode()
      await comfyPage.contextMenu.openForVueNode(fixture.header)

      for (const actionName of imageActionNames) {
        await expect(
          comfyPage.contextMenu.primeVueMenu.getByText(actionName, {
            exact: true
          })
        ).toHaveCount(0)
      }
    })

    test(`restores disconnected ${title} actions`, async ({ comfyPage }) => {
      const fixture = await comfyPage.vueNodes.getFixtureByTitle(title)
      const [node] = await comfyPage.nodeOps.getNodeRefsByType(nodeType)

      await (await node.getInput(0)).removeLinks()
      await node.centerOnNode()
      await comfyPage.contextMenu.openForVueNode(fixture.header)

      for (const actionName of imageActionNames) {
        await expect(
          comfyPage.contextMenu.primeVueMenu.getByText(actionName, {
            exact: true
          })
        ).toBeVisible()
      }
    })
  }
})
