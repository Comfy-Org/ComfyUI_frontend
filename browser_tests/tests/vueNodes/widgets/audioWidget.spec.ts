import { AudioPreview, getWav } from '@e2e/fixtures/components/AudioPreview'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test('@vue-nodes Audio Widget', async ({ comfyPage, comfyFiles }) => {
  await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'v1 (legacy)')

  const loadAudioNode = comfyPage.vueNodes.getNodeByTitle('Load Audio')
  const audioPreview = new AudioPreview(loadAudioNode)

  await test.step('Add node', async () => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    //await comfyPage.canvasOps.doubleClick()
    await comfyPage.page.mouse.dblclick(500, 500, { delay: 5 })
    await comfyPage.searchBox.fillAndSelectFirstNode('Load Audio')
    await expect(loadAudioNode).toBeVisible()
  })

  const filename = `audio-${Date.now()}.wav`

  await test.step('Upload an audio file', async () => {
    const file = { name: filename, buffer: getWav(), mimeType: 'audio/x-wav' }
    await audioPreview.upload.setInputFiles(file)
    comfyFiles.deleteAfterTest({ filename, type: 'input' })
    await expect(loadAudioNode).toContainText(filename)
  })

  await test.step('Preview audio file', async () => {
    await expect(loadAudioNode).toContainText('0:00 / 0:20')

    expect(await audioPreview.isPlaying()).toBe(false)
    await audioPreview.play.click()
    await expect.poll(() => audioPreview.isPlaying()).toBe(true)
    await audioPreview.play.click()
    await expect.poll(() => audioPreview.isPlaying()).toBe(false)

    expect(await audioPreview.isMuted()).toBe(false)
    await audioPreview.volume.click()
    const volumeIcon = audioPreview.volume.locator('i')
    await expect(volumeIcon).toContainClass('icon-[lucide--volume-x]')
    await expect.poll(() => audioPreview.isMuted()).toBe(true)
    await audioPreview.volume.click()
    await expect.poll(() => audioPreview.isMuted()).toBe(false)
    await expect(volumeIcon).not.toContainClass('icon-[lucide--volume-x]')
  })

  await test.step('Redownload uploaded file', async () => {
    const downloadPromise = comfyPage.page.waitForEvent('download')
    await audioPreview.download.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(filename)
  })
})
