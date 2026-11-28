import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  finishedImage,
  finishedVideo
} from '@e2e/fixtures/data/finishedMediaJobs'
import { jobOutputDragTest as test } from '@e2e/fixtures/jobOutputDragFixture'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

test.describe('Job queue output drag', { tag: ['@ui', '@widget'] }, () => {
  test.use({
    initialSettings: {
      'Comfy.Minimap.Visible': false,
      'Comfy.Queue.QPOV2': false
    }
  })

  test('references a finished image on Load Image and keeps it when a finished video is dropped', async ({
    comfyPage
  }) => {
    const { queuePanel } = comfyPage

    const loadImage =
      await test.step('open Load Image and the job queue', async () => {
        await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
        await queuePanel.open()
        return comfyPage.nodeOps.getNodeRefByTitle('Load Image')
      })

    const image = await loadImage.getWidgetByName('image')
    const referencedImage = `${finishedImage.filename} [output]`

    await test.step('drop the finished image on the node', async () => {
      await queuePanel.dragOutputToNode(finishedImage.jobId, loadImage)

      await expect.poll(() => image.getValue()).toBe(referencedImage)
    })

    await test.step('drop the finished video on the node', async () => {
      await queuePanel.dragOutputToNode(finishedVideo.jobId, loadImage)

      await expect(
        comfyPage.toast.toastWarnings.filter({
          hasText: enMessages.mediaAsset.unsupportedFileType
        })
      ).toHaveCount(1)
      expect(await image.getValue()).toBe(referencedImage)
    })
  })

  test('references a finished video dropped on the Load Video player', async ({
    comfyPage
  }) => {
    const { queuePanel } = comfyPage

    const loadVideo =
      await test.step('open Load Video and the job queue', async () => {
        await comfyPage.workflow.loadWorkflow('widgets/load_video_widget')
        await queuePanel.open()
        return comfyPage.nodeOps.getNodeRefByTitle('Load Video')
      })

    await test.step('drop the finished video on the player', async () => {
      await queuePanel.dragOutputToVideoPreview(finishedVideo.jobId, loadVideo)

      const file = await loadVideo.getWidgetByName('file')
      await expect
        .poll(() => file.getValue())
        .toBe(`${finishedVideo.filename} [output]`)
    })
  })

  test('adds a Load Image node for a finished image dropped on empty canvas', async ({
    comfyPage,
    comfyFiles
  }) => {
    const { queuePanel } = comfyPage

    await test.step('open a blank workflow and the job queue', async () => {
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.expectNodeCount(0)
      await queuePanel.open()
      comfyFiles.deleteAfterTest({
        filename: finishedImage.filename,
        type: 'input'
      })
    })

    await test.step('drop the finished image on the canvas', async () => {
      await queuePanel.dragOutputToEmptyCanvas(finishedImage.jobId)

      await expect
        .poll(() => comfyPage.nodeOps.getNodeRefsByType('LoadImage'))
        .toHaveLength(1)
      const loadImage = await comfyPage.nodeOps.getNodeRefByType('LoadImage')
      const image = await loadImage.getWidgetByName('image')
      await expect.poll(() => image.getValue()).toBe(finishedImage.filename)
    })
  })

  test.describe('in Nodes 2.0', { tag: '@vue-nodes' }, () => {
    test('references a finished video dropped on Load Video', async ({
      comfyPage
    }) => {
      const { queuePanel } = comfyPage

      const loadVideo =
        await test.step('open Load Video and the job queue', async () => {
          await comfyPage.workflow.loadWorkflow('widgets/load_video_widget')
          await queuePanel.open()
          return comfyPage.nodeOps.getNodeRefByTitle('Load Video')
        })

      await test.step('drop the finished video on the node', async () => {
        await queuePanel.dragOutputToNode(finishedVideo.jobId, loadVideo)

        const file = await loadVideo.getWidgetByName('file')
        await expect
          .poll(() => file.getValue())
          .toBe(`${finishedVideo.filename} [output]`)
      })
    })
  })
})
