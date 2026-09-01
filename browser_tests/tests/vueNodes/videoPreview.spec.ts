import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VideoPreview } from '@e2e/fixtures/components/VideoPreview'
import { assetPath } from '@e2e/fixtures/utils/paths'

const file1 = 'workflow.mp4' as const
const file2 = 'workflow.webm' as const

test('@vue-nodes Load Video', async ({ comfyPage, comfyFiles }) => {
  await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'v1 (legacy)')

  const loadVideoNode = comfyPage.vueNodes.getNodeByTitle('Load Video')
  const loadVideo = new VideoPreview(loadVideoNode)

  await test.step('Add node', async () => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await comfyPage.page.mouse.dblclick(500, 300, { delay: 5 })
    await comfyPage.searchBox.fillAndSelectFirstNode('Load Video')

    await expect(loadVideoNode).toHaveCount(1)
    await expect(loadVideoNode).toBeVisible()
  })

  await test.step('Upload a video file', async () => {
    await loadVideo.upload.setInputFiles(assetPath(`workflowInMedia/${file1}`))
    comfyFiles.deleteAfterTest({ filename: file1, type: 'input' })
    await expect(loadVideoNode).toContainText(file1)
    await expect(loadVideo.video).toBeVisible()
  })

  await test.step('Update displayed video', async () => {
    const initialSrc = await loadVideo.videoSrc()
    await loadVideo.upload.setInputFiles(assetPath(`workflowInMedia/${file2}`))
    comfyFiles.deleteAfterTest({ filename: file2, type: 'input' })
    await expect(loadVideoNode).toContainText(file2)
    await expect.poll(() => loadVideo.videoSrc()).not.toEqual(initialSrc)
  })

  await test.step('Display multiple videmus', async () => {
    await expect(loadVideo.navigationDots).toBeHidden()

    //forcibly display multiple video files at once
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
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)

    await expect(loadVideo.navigationDots).toHaveCount(2)
    await loadVideo.navigationDots.nth(0).click()
    await expect.poll(() => loadVideo.videoSrc()).toContain(file1)
    await loadVideo.navigationDots.nth(1).click()
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
