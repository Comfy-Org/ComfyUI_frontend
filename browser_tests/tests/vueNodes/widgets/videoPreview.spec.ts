import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VideoPreview } from '@e2e/fixtures/components/VideoPreview'
import { assetPath } from '@e2e/fixtures/utils/paths'

test('Load Video', async ({ comfyPage }) => {
  const file1 = 'workflow.mp4'
  const file2 = 'workflow.webm'

  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'v1 (legacy)')
  await comfyPage.vueNodes.waitForNodes()

  const loadVideoNode = comfyPage.vueNodes.getNodeByTitle('Load Video')
  const loadVideo = new VideoPreview(loadVideoNode)

  await test.step('Can add node', async () => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    await comfyPage.page.mouse.dblclick(500, 300, { delay: 5 })
    await comfyPage.searchBox.fillAndSelectFirstNode('Load Video')
    //await new Promise(r => setTimeout(r, 5000))
    await expect(loadVideoNode).toHaveCount(1)
    await expect(loadVideoNode).toBeVisible()
    await expect(loadVideoNode.locator('video')).toBeVisible()
  })

  await test.step('Can upload a video file', async () => {
    await loadVideo.upload.setInputFiles(assetPath(`workflowInMedia/${file1}`))
    comfyPage.deleteFileAfterTest({ filename: file1, type: 'input' })
    await expect(loadVideoNode).toContainText(file1)
    await expect(loadVideo.video).toBeVisible()
  })

  await test.step('Can update displayed video', async () => {
    const initialSrc = await loadVideo.videoSrc()
    await loadVideo.upload.setInputFiles(assetPath(`workflowInMedia/${file2}`))
    comfyPage.deleteFileAfterTest({ filename: file2, type: 'input' })
    await expect(loadVideoNode).toContainText(file2)
    await expect.poll(() => loadVideo.videoSrc()).not.toEqual(initialSrc)
  })

  await test.step('Can display multiple video', async () => {
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
