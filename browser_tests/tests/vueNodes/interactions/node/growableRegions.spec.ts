import { mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import { VideoPreview } from '@e2e/fixtures/components/VideoPreview'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import {
  boxAspectRatio,
  heightOf,
  requireBoundingBox
} from '@e2e/fixtures/utils/locatorBox'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { webSocketFixture } from '@e2e/fixtures/ws'

const wstest = mergeTests(test, webSocketFixture)

test.describe(
  'Vue node growable regions',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  () => {
    test.use({ initialSettings: { 'Comfy.Minimap.Visible': false } })

    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('vueNodes/growable-regions')
    })

    test('dragging a widget edge resizes only that widget and moves the node bottom with it', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const textG = node.widgetRow('text_g')
      const textL = node.widgetRow('text_l')
      const getTextGHeight = () => heightOf(textG)
      const getTextLHeight = () => heightOf(textL)
      const getHeight = () => heightOf(node.root)
      const initialTextG = await getTextGHeight()
      const initialTextL = await getTextLHeight()
      const initialHeight = await getHeight()

      await node.dragHandle(node.growableRegionHandle(textG), 0, 80)

      await expect.poll(getTextGHeight).toBeCloseTo(initialTextG + 80, 0)
      await expect.poll(getTextLHeight).toBeCloseTo(initialTextL, 0)
      await expect.poll(getHeight).toBeCloseTo(initialHeight + 80, 0)
    })

    test('undoing a widget edge drag returns the widget and the node to their earlier heights, and redo applies it again', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const textG = node.widgetRow('text_g')
      const getTextGHeight = () => heightOf(textG)
      const getHeight = () => heightOf(node.root)
      const initialTextG = await getTextGHeight()
      const initialHeight = await getHeight()

      await node.dragHandle(node.growableRegionHandle(textG), 0, 80)
      await expect.poll(getTextGHeight).toBeCloseTo(initialTextG + 80, 0)

      await comfyPage.keyboard.undo()

      await expect.poll(getTextGHeight).toBeCloseTo(initialTextG, 0)
      await expect.poll(getHeight).toBeCloseTo(initialHeight, 0)

      await comfyPage.keyboard.redo()

      await expect.poll(getTextGHeight).toBeCloseTo(initialTextG + 80, 0)
      await expect.poll(getHeight).toBeCloseTo(initialHeight + 80, 0)
    })

    test('a widget and preview height the user dragged survive saving and reopening the workflow', async ({
      comfyPage
    }) => {
      const clip = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const loadImage = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
      await loadImage.waitForImageLoaded('example.png')
      const initialTextG = await heightOf(clip.widgetRow('text_g'))
      const initialPreview = await heightOf(loadImage.imagePreview)
      await clip.dragHandle(
        clip.growableRegionHandle(clip.widgetRow('text_g')),
        0,
        80
      )
      await loadImage.dragHandle(loadImage.growableRegionHandle(), 0, 60)
      await expect
        .poll(() => heightOf(clip.widgetRow('text_g')))
        .toBeCloseTo(initialTextG + 80, 0)

      const workflow = await comfyPage.workflow.getExportedWorkflow()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.loadGraphData(workflow)

      const reopenedClip = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const reopenedImage =
        await comfyPage.vueNodes.getFixtureByTitle('Load Image')
      await reopenedImage.waitForImageLoaded('example.png')
      await expect
        .poll(() => heightOf(reopenedClip.widgetRow('text_g')))
        .toBeCloseTo(initialTextG + 80, 0)
      await expect
        .poll(() => heightOf(reopenedImage.imagePreview))
        .toBeCloseTo(initialPreview + 60, 0)
    })

    test('a node resize grows only the widgets the user has not sized', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const textG = node.widgetRow('text_g')
      const textL = node.widgetRow('text_l')
      const getTextGHeight = () => heightOf(textG)
      const getTextLHeight = () => heightOf(textL)
      const initialTextG = await getTextGHeight()
      const initialTextL = await getTextLHeight()

      await node.dragHandle(node.growableRegionHandle(textG), 0, 60)
      await expect.poll(getTextGHeight).toBeCloseTo(initialTextG + 60, 0)

      await node.resizeFromCorner('SE', 0, 100)

      await expect.poll(getTextLHeight).toBeCloseTo(initialTextL + 100, 0)
      await expect.poll(getTextGHeight).toBeCloseTo(initialTextG + 60, 0)
    })

    test('a node resize stops a widget at its maximum height and gives the rest to the other widgets', async ({
      comfyPage
    }) => {
      await comfyPage.page.evaluate(() => {
        window.app!.registerExtension({
          name: 'test.growableRegions.maxHeight',
          nodeCreated(node) {
            const textG = node.widgets?.find(({ name }) => name === 'text_g')
            if (textG) Object.assign(textG.options, { getMaxHeight: () => 120 })
          }
        })
      })
      await comfyPage.workflow.loadWorkflow('vueNodes/growable-regions')
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const getTextGHeight = () => heightOf(node.widgetRow('text_g'))
      const getTextLHeight = () => heightOf(node.widgetRow('text_l'))
      const getHeight = () => heightOf(node.root)
      const initialTextG = await getTextGHeight()
      const initialTextL = await getTextLHeight()
      const initialHeight = await getHeight()
      expect(initialTextG).toBeLessThan(100)

      await node.resizeFromCorner('SE', 0, 200)

      await expect.poll(getHeight).toBeCloseTo(initialHeight + 200, 0)
      await expect.poll(getTextGHeight).toBeCloseTo(120, 0)
      await expect
        .poll(getTextLHeight)
        .toBeCloseTo(initialTextL + 200 - (120 - initialTextG), 0)

      await node.getResizeHandle('SE').dblclick()

      await expect.poll(getHeight).toBeCloseTo(initialHeight, 0)
      await expect.poll(getTextGHeight).toBeCloseTo(initialTextG, 0)
    })

    test('a node resize gives the image preview the height a capped widget cannot take', async ({
      comfyPage
    }) => {
      await comfyPage.page.evaluate(() => {
        const loadImage = window.app!.graph.nodes.find(
          ({ type }) => type === 'LoadImage'
        )
        const element = document.createElement('div')
        element.setAttribute('aria-label', 'capped')
        loadImage?.addDOMWidget('capped', 'capped', element, {
          serialize: false,
          getMinHeight: () => 40,
          getMaxHeight: () => 80
        })
      })
      const node = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
      await node.waitForImageLoaded('example.png')
      await expect(node.widgetRow('capped')).toBeVisible()
      const getRowHeight = () => heightOf(node.widgetRow('capped'))
      const getPreviewHeight = () => heightOf(node.imagePreview)
      const getHeight = () => heightOf(node.root)
      const initialRow = await getRowHeight()
      const initialPreview = await getPreviewHeight()
      const initialHeight = await getHeight()
      expect(initialRow).toBeLessThan(60)

      await node.resizeFromCorner('SE', 0, 200)

      await expect.poll(getHeight).toBeCloseTo(initialHeight + 200, 0)
      await expect.poll(getRowHeight).toBeCloseTo(80, 0)
      await expect
        .poll(getPreviewHeight)
        .toBeCloseTo(initialPreview + 200 - (80 - initialRow), 0)
    })

    test('double-clicking a textarea edge fits it to its text, but no fewer than three lines', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      await node
        .widgetRow('text_g')
        .getByRole('textbox')
        .fill('one\ntwo\nthree\nfour\nfive\nsix\n\n')
      await node.resizeFromCorner('SE', 0, 300)
      await expect
        .poll(() => node.textareaLineFitError('text_g', 6))
        .toBeGreaterThan(20)

      await node.growableRegionHandle(node.widgetRow('text_g')).dblclick()
      await node.growableRegionHandle(node.widgetRow('text_l')).dblclick()

      await expect
        .poll(() => node.textareaLineFitError('text_g', 6))
        .toBeLessThanOrEqual(1)
      await expect
        .poll(() => node.textareaLineFitError('text_l', 3))
        .toBeLessThanOrEqual(1)
    })

    test('fitting a long textarea leaves everything past 30 lines scrollable', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const row = node.widgetRow('text_g')
      const textarea = row.getByRole('textbox')
      const text = Array.from(
        { length: 50 },
        (_, index) => `Line ${index + 1}`
      ).join('\n')
      await textarea.fill(text)

      await node.growableRegionHandle(row).dblclick()

      await expect
        .poll(() => node.textareaLineFitError('text_g', 30))
        .toBeLessThanOrEqual(1)
      expect(
        await textarea.evaluate(
          (element) => element.scrollHeight > element.clientHeight
        )
      ).toBe(true)
      await expect(textarea).toHaveValue(text)
    })

    test('double-clicking a resize corner shrinks the node to its content, keeping user-sized widgets', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (SDXL)'
      )
      const textG = node.widgetRow('text_g')
      const getTextGHeight = () => heightOf(textG)
      const getHeight = () => heightOf(node.root)
      const initialTextG = await getTextGHeight()
      const initialHeight = await getHeight()

      await node.dragHandle(node.growableRegionHandle(textG), 0, 60)
      await node.resizeFromCorner('SE', 0, 150)
      await expect.poll(getHeight).toBeGreaterThan(initialHeight + 200)

      await node.getResizeHandle('SE').dblclick()

      await expect.poll(getHeight).toBeCloseTo(initialHeight + 60, 0)
      await expect.poll(getTextGHeight).toBeCloseTo(initialTextG + 60, 0)
    })

    test('a node whose only widget grows keeps that widget filling the node, and every corner fits the widget', async ({
      comfyPage
    }) => {
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.searchBoxV2.addNode('CLIP Text Encode (Prompt)')
      const node = await comfyPage.vueNodes.getFixtureByTitle(
        'CLIP Text Encode (Prompt)'
      )
      const text = node.widgetRow('text')
      const getDeadSpace = async () =>
        (await heightOf(node.root)) - (await heightOf(text))
      const initialDeadSpace = await getDeadSpace()
      const initialText = await heightOf(text)

      await node.dragHandle(node.growableRegionHandle(text), 0, 40)
      await expect.poll(() => heightOf(text)).toBeCloseTo(initialText + 40, 0)
      await node.resizeFromCorner('SE', 0, 50)
      await expect.poll(() => heightOf(text)).toBeCloseTo(initialText + 90, 0)
      await expect.poll(getDeadSpace).toBeCloseTo(initialDeadSpace, 0)

      for (const corner of ['SE', 'NE'] as const) {
        await node.resizeFromCorner('SE', 0, 50)
        await expect
          .poll(() => node.textareaLineFitError('text', 3))
          .toBeGreaterThan(20)

        await node.getResizeHandle(corner).dblclick()

        await expect
          .poll(() => node.textareaLineFitError('text', 3))
          .toBeLessThanOrEqual(1)
        await expect.poll(getDeadSpace).toBeCloseTo(initialDeadSpace, 0)
      }
    })

    test('dragging the image preview edge grows the preview and the node by the same amount', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
      await node.waitForImageLoaded('example.png')
      const getPreviewHeight = () => heightOf(node.imagePreview)
      const getHeight = () => heightOf(node.root)
      const initialPreview = await getPreviewHeight()
      const initialHeight = await getHeight()

      await node.dragHandle(node.growableRegionHandle(), 0, 100)

      await expect.poll(getPreviewHeight).toBeCloseTo(initialPreview + 100, 0)
      await expect.poll(getHeight).toBeCloseTo(initialHeight + 100, 0)
    })

    test('double-clicking the image preview edge fits the preview to the image aspect ratio', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('Load Image')
      await node.waitForImageLoaded('example.png')
      const image = node.imagePreview.getByTestId('main-image')
      const naturalAspectRatio = await image.evaluate(
        (img: HTMLImageElement) => img.naturalWidth / img.naturalHeight
      )
      const getAspectRatio = async () => {
        const box = await image.boundingBox()
        return box ? box.width / box.height : -1
      }

      await node.resizeFromCorner('SE', 0, 300)
      await expect.poll(getAspectRatio).toBeLessThan(naturalAspectRatio - 0.1)

      await node.growableRegionHandle().dblclick()

      await expect.poll(getAspectRatio).toBeCloseTo(naturalAspectRatio, 2)
    })

    test('dragging the text preview edge grows the preview and the node by the same amount', async ({
      comfyPage
    }) => {
      const node = await comfyPage.vueNodes.getFixtureByTitle('Preview as Text')
      const preview = node.root.getByTestId('node-widget').filter({
        has: comfyPage.page.getByTestId('growable-region-handle')
      })
      const getPreviewHeight = () => heightOf(preview)
      const getHeight = () => heightOf(node.root)
      const initialPreview = await getPreviewHeight()
      const initialHeight = await getHeight()

      await node.dragHandle(node.growableRegionHandle(preview), 0, 80)

      await expect.poll(getPreviewHeight).toBeCloseTo(initialPreview + 80, 0)
      await expect.poll(getHeight).toBeCloseTo(initialHeight + 80, 0)
    })
  }
)

test(
  'fitting a Markdown Note caps its rendered content without hiding the rest',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  async ({ comfyPage }) => {
    const text = Array.from(
      { length: 50 },
      (_, index) => `Line ${index + 1}`
    ).join('  \n')
    await comfyPage.workflow.loadWorkflow('nodes/note_nodes', {
      nodes: { 2: { widgets_values: [text] } }
    })
    const node = await comfyPage.vueNodes.getFixtureByTitle('Markdown Note')
    const markdown = node.root.getByRole('region', { name: 'text' })
    await expect(markdown).toContainText('Line 50')

    await node.getResizeHandle('SE').dblclick()

    await expect
      .poll(() =>
        markdown.evaluate((element) => {
          const lineHeight = Number.parseFloat(
            getComputedStyle(element).lineHeight
          )
          return element.clientHeight / lineHeight
        })
      )
      .toBeCloseTo(30, 0)
    await expect
      .poll(() =>
        markdown.evaluate(
          (element) => element.scrollHeight > element.clientHeight
        )
      )
      .toBe(true)
  }
)

test(
  'double-clicking a resize corner shrinks a node whose last row is an unsized legacy widget',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  async ({ comfyPage }) => {
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.evaluate(() => {
      const checkpoint = window.app!.graph.nodes.find(
        ({ type }) => type === 'CheckpointLoaderSimple'
      )
      checkpoint?.addCustomWidget({
        name: 'legacy',
        type: 'legacy-canvas',
        value: 0,
        y: 0,
        options: {},
        draw: () => {}
      })
    })
    const node = await comfyPage.vueNodes.getFixtureByTitle('Load Checkpoint')
    await expect(node.root.getByTestId('node-widget')).toHaveCount(2)
    const getHeight = () => heightOf(node.root)
    const initialHeight = await getHeight()

    await node.resizeFromCorner('SE', 0, 100)
    await expect.poll(getHeight).toBeCloseTo(initialHeight + 100, 0)

    await node.getResizeHandle('SE').dblclick()

    await expect.poll(getHeight).toBeLessThan(initialHeight + 20)
  }
)

test.describe(
  'Vue node media preview aspect fit',
  { tag: ['@vue-nodes', '@canvas', '@node'] },
  () => {
    test.use({ initialSettings: { 'Comfy.Minimap.Visible': false } })

    async function addLoadVideo(comfyPage: ComfyPage, filename: string) {
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.searchBoxV2.addNode('Load Video')
      const preview = new VideoPreview(
        comfyPage.vueNodes.getNodeByTitle('Load Video')
      )
      await preview.uploadAndLoad(assetPath(`video/${filename}`))
      return {
        node: await comfyPage.vueNodes.getFixtureByTitle('Load Video'),
        video: preview.video
      }
    }

    wstest(
      'double-clicking a corner of a wide video output node widens the node until the video fits',
      async ({ comfyPage, getWebSocket }) => {
        const filename = 'video-preview-wide.webm'
        await comfyPage.page.route(
          (url) =>
            url.pathname.endsWith('/api/view') &&
            url.searchParams.get('filename') === filename,
          (route) => route.fulfill({ path: assetPath(`video/${filename}`) })
        )
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.searchBoxV2.addNode('Preview Image')
        const node = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
        const jobId = await execution.run()
        execution.executed(jobId, '1', {
          images: [{ filename, subfolder: '', type: 'output' }],
          animated: [true]
        })
        const video = new VideoPreview(node.root).video
        await expect
          .poll(() =>
            video.evaluate((element: HTMLVideoElement) => element.videoWidth)
          )
          .toBeGreaterThan(0)
        const before = await requireBoundingBox(node.root)
        await expect.poll(() => boxAspectRatio(video)).toBeLessThan(2)

        await node.getResizeHandle('NE').dblclick()

        await expect.poll(() => boxAspectRatio(video)).toBeCloseTo(4, 1)
        const after = await requireBoundingBox(node.root)
        expect(after.width).toBeGreaterThan(before.width + 100)
        expect(after.height).toBeCloseTo(before.height, 0)
      }
    )

    wstest(
      'a fitted Save Image preview still grows when the node is resized',
      async ({ comfyPage, getWebSocket }) => {
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.searchBoxV2.addNode('Save Image')
        const node = await comfyPage.vueNodes.getFixtureByTitle('Save Image')
        const jobId = await execution.run()
        execution.executed(jobId, '1', {
          images: [{ filename: 'example.png', type: 'input' }]
        })
        await node.waitForImageLoaded('example.png')
        const image = node.imagePreview.getByTestId('main-image')

        await node.getResizeHandle('SE').dblclick()
        await comfyPage.nextFrame()
        await expect.poll(() => boxAspectRatio(image)).toBeCloseTo(1, 2)
        const fittedHeight = await heightOf(image)

        await node.resizeFromCorner('SE', 80, 80)
        await comfyPage.nextFrame()

        await expect
          .poll(() => heightOf(image))
          .toBeCloseTo(fittedHeight + 80, 0)
        await expect.poll(() => boxAspectRatio(image)).toBeCloseTo(1, 2)

        const edge = node.growableRegionHandle()
        await node.dragHandle(edge, 0, -60)
        await node.resizeFromCorner('SE', 40, 110)

        await expect
          .poll(async () => {
            const preview = await requireBoundingBox(node.imagePreview)
            const handle = await requireBoundingBox(edge)
            return Math.abs(
              handle.y + handle.height / 2 - preview.y - preview.height
            )
          })
          .toBeLessThan(8)

        await edge.dblclick()
        await expect.poll(() => boxAspectRatio(image)).toBeCloseTo(1, 2)
      }
    )

    test('double-clicking the edge of a portrait video preview grows the node taller until the video fits', async ({
      comfyPage,
      comfyFiles
    }) => {
      const filename = 'video-preview-portrait.webm'
      comfyFiles.deleteAfterTest({ filename, type: 'input' })
      const { node, video } = await addLoadVideo(comfyPage, filename)
      const before = await requireBoundingBox(node.root)
      await expect.poll(() => boxAspectRatio(video)).toBeGreaterThan(1)

      await node.growableRegionHandle().dblclick()

      await expect.poll(() => boxAspectRatio(video)).toBeCloseTo(90 / 160, 1)
      const after = await requireBoundingBox(node.root)
      expect(after.width).toBeCloseTo(before.width, 0)
      expect(after.height).toBeGreaterThan(before.height + 100)
    })

    test('each preview promoted to a subgraph node resizes on its own', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-multiple-promoted-previews'
      )
      await comfyPage.command.executeCommand('Comfy.QueuePrompt')
      const host = new VueNodeFixture(comfyPage.vueNodes.getNodeLocator('7'))
      const [first, second] = [0, 1].map((index) =>
        host.imagePreview.nth(index)
      )
      await expect(host.imagePreview.locator('img')).toHaveCount(2, {
        timeout: 30_000
      })
      const firstHeight = await heightOf(first)
      const secondHeight = await heightOf(second)

      await host.dragHandle(
        host.root.getByRole('separator', { name: 'Resize preview 1 height' }),
        0,
        80
      )

      await expect.poll(() => heightOf(first)).toBeGreaterThan(firstHeight + 40)
      expect(await heightOf(second)).toBeCloseTo(secondHeight, 0)

      const images = host.imagePreview.getByRole('img')
      await expect
        .poll(() =>
          images.evaluateAll(
            (elements) =>
              elements.filter(
                (element) =>
                  element instanceof HTMLImageElement && element.naturalWidth
              ).length
          )
        )
        .toBe(2)
      const corner = host.getResizeHandle('NE')
      await corner.dblclick()
      await comfyPage.nextFrame()
      const fittedHeight = await heightOf(host.root)

      await host.resizeFromCorner('NE', 0, -100)
      await comfyPage.nextFrame()
      await expect
        .poll(() => heightOf(host.root))
        .toBeGreaterThan(fittedHeight + 90)

      await corner.dblclick()
      await comfyPage.nextFrame()
      await expect.poll(() => heightOf(host.root)).toBeCloseTo(fittedHeight, 0)
    })

    wstest(
      'an image grid uses content fitting even when only one thumbnail loads',
      async ({ comfyPage, getWebSocket }) => {
        const missing = 'missing-thumbnail.exr'
        await comfyPage.page.route(
          (url) => url.searchParams.get('filename') === missing,
          (route) => route.fulfill({ status: 404 })
        )
        const execution = new ExecutionHelper(comfyPage, await getWebSocket())
        await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
        await comfyPage.searchBoxV2.addNode('Preview Image')
        const node = await comfyPage.vueNodes.getFixtureByTitle('Preview Image')
        const file = { filename: 'example.png', type: 'input' }
        const jobId = await execution.run()
        execution.executed(jobId, '1', {
          images: [file, { ...file, filename: missing }]
        })
        await expect(node.imageGrid.getByRole('button')).toHaveCount(2)
        await expect(node.imageGrid.getByRole('img')).toHaveCount(1)
        await expect
          .poll(() =>
            node.imageGrid
              .getByRole('img')
              .evaluate((image: HTMLImageElement) => image.naturalWidth)
          )
          .toBeGreaterThan(0)
        const before = await requireBoundingBox(node.root)
        await node.resizeFromCorner('SE', 120, 170)
        await comfyPage.nextFrame()
        const wider = await requireBoundingBox(node.root)
        await node.getResizeHandle('SE').dblclick()
        await comfyPage.nextFrame()
        const fitted = await requireBoundingBox(node.root)
        expect(fitted.width).toBeCloseTo(wider.width, 0)
        expect(fitted.height).toBeCloseTo(before.height, 0)

        const getGridHeight = () => heightOf(node.imageGrid)

        await node.dragHandle(node.growableRegionHandle(), 0, 80)
        await comfyPage.nextFrame()
        const sized = await requireBoundingBox(node.root)
        await node.growableRegionHandle().dblclick()
        await comfyPage.nextFrame()

        const released = await requireBoundingBox(node.root)
        expect(released.width).toBeCloseTo(sized.width, 0)
        expect(released.height).toBeCloseTo(sized.height, 0)
        const releasedGridHeight = await getGridHeight()
        await node.resizeFromCorner('SE', 0, 100)
        await expect
          .poll(getGridHeight)
          .toBeCloseTo(releasedGridHeight + 100, 0)
      }
    )
  }
)
