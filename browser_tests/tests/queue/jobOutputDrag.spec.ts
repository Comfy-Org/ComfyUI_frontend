import { mergeTests } from '@playwright/test'

import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import {
  draggedImageOutput,
  draggedVideoOutput,
  jobOutputDragJobs
} from '@e2e/fixtures/data/jobOutputDrag'
import { jobsRouteFixture } from '@e2e/fixtures/jobsRouteFixture'
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

  test.describe('onto a loader node', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('widgets/all_load_widgets')
      await comfyPage.queuePanel.open()
    })

    for (const { output, title, nodeId, widgetName } of [
      {
        output: draggedImageOutput,
        title: 'Load Image',
        nodeId: '5',
        widgetName: 'image'
      },
      {
        output: draggedVideoOutput,
        title: 'Load Video',
        nodeId: '2',
        widgetName: 'file'
      }
    ]) {
      test(`references ${output.filename} as the ${title} input`, async ({
        comfyPage
      }) => {
        const node = await comfyPage.nodeOps.getNodeRefById(nodeId)
        await node.centerOnNode()
        const center = await comfyPage.canvasOps.getNodeCenterByTitle(title)
        if (!center) throw new Error(`${title} node center not found`)

        await comfyPage.queuePanel.dragOutputTo(output.jobId, center)

        const widget = await node.getWidgetByName(widgetName)
        await expect
          .poll(() => widget.getValue())
          .toBe(`${output.filename} [output]`)
      })
    }

    test('keeps the Load Image input and warns when a video is dropped on it', async ({
      comfyPage
    }) => {
      const node = await comfyPage.nodeOps.getNodeRefById('5')
      const widget = await node.getWidgetByName('image')
      const imageBefore = await widget.getValue()
      await node.centerOnNode()
      const center =
        await comfyPage.canvasOps.getNodeCenterByTitle('Load Image')
      if (!center) throw new Error('Load Image node center not found')

      await comfyPage.queuePanel.dragOutputTo(draggedVideoOutput.jobId, center)

      await expect(
        comfyPage.toast.toastWarnings.filter({
          hasText: enMessages.mediaAsset.unsupportedFileType
        })
      ).toHaveCount(1)
      expect(await widget.getValue()).toBe(imageBefore)
    })
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
      await comfyPage.workflow.loadWorkflow('widgets/all_load_widgets')
      await comfyPage.menu.jobHistoryTab.open()
      const node = await comfyPage.nodeOps.getNodeRefById('5')
      await node.centerOnNode()
      const center =
        await comfyPage.canvasOps.getNodeCenterByTitle('Load Image')
      if (!center) throw new Error('Load Image node center not found')

      await comfyPage.queuePanel.dragOutputTo(draggedImageOutput.jobId, center)

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
      await comfyPage.workflow.loadWorkflow('widgets/all_load_widgets')
      await comfyPage.queuePanel.open()
      const node = await comfyPage.nodeOps.getNodeRefById('2')
      await node.centerOnNode()
      const center =
        await comfyPage.canvasOps.getNodeCenterByTitle('Load Video')
      if (!center) throw new Error('Load Video node center not found')

      await comfyPage.queuePanel.dragOutputTo(draggedVideoOutput.jobId, center)

      const widget = await node.getWidgetByName('file')
      await expect
        .poll(() => widget.getValue())
        .toBe(`${draggedVideoOutput.filename} [output]`)
    })
  })
})
