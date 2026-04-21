import { AudioPreview, getWav } from '@e2e/fixtures/components/AudioPreview'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'

test('Audio Widget', async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
  await comfyPage.settings.setSetting('Comfy.NodeSearchBoxImpl', 'v1 (legacy)')
  await comfyPage.vueNodes.waitForNodes()

  const loadAudioNode = comfyPage.vueNodes.getNodeByTitle('Load Audio')
  const audioPreview = new AudioPreview(loadAudioNode)

  await test.step('Can add node', async () => {
    await comfyPage.menu.topbar.newWorkflowButton.click()
    await comfyPage.nextFrame()

    //await comfyPage.canvasOps.doubleClick()
    await comfyPage.page.mouse.dblclick(500, 500, { delay: 5 })
    await comfyPage.searchBox.fillAndSelectFirstNode('Load Audio')
    await expect(loadAudioNode).toBeVisible()
  })

  const fileName = `audio-${Date.now()}.wav`

  await test.step('Can upload an audio file', async () => {
    const file = { name: fileName, buffer: getWav(), mimeType: 'audio/x-wav' }
    await audioPreview.upload.setInputFiles(file)
    await expect(loadAudioNode).toContainText(fileName)
    //dnd is bugged
    expect(await comfyPage.vueNodes.getNodeCount()).toBe(1)
  })

  await test.step('Previews audio files', async () => {
    expect(loadAudioNode).toContainText('0:00 / 0:20')

    expect(await audioPreview.isPlaying()).toBe(false)
    await audioPreview.play.click()
    await expect.poll(() => audioPreview.isPlaying()).toBe(true)
    await audioPreview.play.click()
    await expect.poll(() => audioPreview.isPlaying()).toBe(false)

    expect(await audioPreview.isMuted()).toBe(false)
    await audioPreview.volume.click()
    await expect.poll(() => audioPreview.isMuted()).toBe(true)
    await audioPreview.volume.click()
    await expect.poll(() => audioPreview.isMuted()).toBe(false)
  })

  await test.step('Can redownload uploaded file', async () => {
    const downloadPromise = comfyPage.page.waitForEvent('download')
    await audioPreview.download.click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(fileName)
  })
})
