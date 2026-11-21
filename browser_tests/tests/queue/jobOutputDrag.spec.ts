import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  draggedImageOutput,
  draggedVideoOutput,
  jobOutputDragJobs,
  loadVideoInputFilename
} from '@e2e/fixtures/data/jobOutputDrag'
import { jobsRouteFixture } from '@e2e/fixtures/jobsRouteFixture'
import { TestIds } from '@e2e/fixtures/selectors'
import { assetPath } from '@e2e/fixtures/utils/paths'
import enMessages from '@/locales/en/main.json' with { type: 'json' }

const test = mergeTests(comfyPageFixture, jobsRouteFixture).extend<{
  finishedJobs: void
}>({
  finishedJobs: [
    async ({ jobsRoutes, page }, use) => {
      await jobsRoutes.mockJobsScenario({
        history: [...jobOutputDragJobs],
        queue: []
      })
      await page.route(
        (url) =>
          url.pathname.endsWith('/view') &&
          url.searchParams.get('filename') === draggedImageOutput.filename,
        (route) =>
          route.fulfill({
            path: assetPath('test_upload_image.png'),
            contentType: 'image/png'
          })
      )
      await page.route(
        (url) =>
          url.pathname.endsWith('/view') &&
          url.searchParams.get('filename') === loadVideoInputFilename,
        (route) =>
          route.fulfill({
            path: assetPath('plain_video.mp4'),
            contentType: 'video/mp4'
          })
      )
      await use()
    },
    { auto: true }
  ]
})

test.describe('Job queue output drag', { tag: ['@ui', '@widget'] }, () => {
  test.use({
    initialSettings: {
      'Comfy.Minimap.Visible': false,
      'Comfy.Queue.QPOV2': false
    }
  })

  test.describe('onto Load Image', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      await comfyPage.queuePanel.open()
    })

    test('references a finished image as its input', async ({ comfyPage }) => {
      const node = await comfyPage.nodeOps.getNodeRefById('10')

      await comfyPage.queuePanel.dragOutputToNode(
        draggedImageOutput.jobId,
        node
      )

      const widget = await node.getWidgetByName('image')
      await expect
        .poll(() => widget.getValue())
        .toBe(`${draggedImageOutput.filename} [output]`)
    })

    test('keeps its input and warns when a finished video is dropped on it', async ({
      comfyPage
    }) => {
      const node = await comfyPage.nodeOps.getNodeRefById('10')
      const widget = await node.getWidgetByName('image')
      const imageBefore = await widget.getValue()

      await comfyPage.queuePanel.dragOutputToNode(
        draggedVideoOutput.jobId,
        node
      )

      await expect(
        comfyPage.toast.toastWarnings.filter({
          hasText: enMessages.mediaAsset.unsupportedFileType
        })
      ).toHaveCount(1)
      expect(await widget.getValue()).toBe(imageBefore)
    })
  })

  test('references a finished video dropped on the Load Video player', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow('widgets/load_video_widget')
    const node = await comfyPage.nodeOps.getNodeRefById('2')
    await node.centerOnNode()
    await comfyPage.queuePanel.open()

    await comfyPage.queuePanel.dragOutputOnto(
      draggedVideoOutput.jobId,
      comfyPage.page.getByTestId(TestIds.canvas.domWidgets).locator('video')
    )

    const widget = await node.getWidgetByName('file')
    await expect
      .poll(() => widget.getValue())
      .toBe(`${draggedVideoOutput.filename} [output]`)
  })

  test('adds a Load Image node for a finished image dropped on empty canvas', async ({
    comfyPage,
    comfyFiles
  }) => {
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await comfyPage.expectNodeCount(0)
    await comfyPage.queuePanel.open()
    comfyFiles.deleteAfterTest({
      filename: draggedImageOutput.filename,
      type: 'input'
    })

    await comfyPage.queuePanel.dragOutputTo(draggedImageOutput.jobId, {
      x: 300,
      y: 300
    })

    await expect
      .poll(() => comfyPage.nodeOps.getNodeRefsByType('LoadImage'))
      .toHaveLength(1)
    const [loadImage] = await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
    const widget = await loadImage.getWidgetByName('image')
    await expect.poll(() => widget.getValue()).toBe(draggedImageOutput.filename)
  })

  test.describe('from the docked job history panel', () => {
    test.use({
      initialSettings: {
        'Comfy.Minimap.Visible': false,
        'Comfy.Queue.QPOV2': true
      }
    })

    test('references a finished image as the Load Image input', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_image_widget')
      await comfyPage.menu.jobHistoryTab.open()
      const node = await comfyPage.nodeOps.getNodeRefById('10')

      await comfyPage.queuePanel.dragOutputToNode(
        draggedImageOutput.jobId,
        node
      )

      const widget = await node.getWidgetByName('image')
      await expect
        .poll(() => widget.getValue())
        .toBe(`${draggedImageOutput.filename} [output]`)
    })
  })

  test.describe('in Nodes 2.0', { tag: '@vue-nodes' }, () => {
    test('references a finished video as the Load Video input', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('widgets/load_video_widget')
      await comfyPage.queuePanel.open()
      const node = await comfyPage.nodeOps.getNodeRefById('2')

      await comfyPage.queuePanel.dragOutputToNode(
        draggedVideoOutput.jobId,
        node
      )

      const widget = await node.getWidgetByName('file')
      await expect
        .poll(() => widget.getValue())
        .toBe(`${draggedVideoOutput.filename} [output]`)
    })
  })
})
