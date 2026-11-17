import { mergeTests } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  comfyExpect as expect,
  comfyPageFixture
} from '@e2e/fixtures/ComfyPage'
import { ExecutionHelper } from '@e2e/fixtures/helpers/ExecutionHelper'
import { canvasVideo, output } from '@e2e/fixtures/helpers/nodeOutputPreview'
import { heightOf, requireBoundingBox } from '@e2e/fixtures/utils/locatorBox'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'
import type { VueNodeFixture } from '@e2e/fixtures/utils/vueNodeFixtures'
import { webSocketFixture } from '@e2e/fixtures/ws'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

const test = mergeTests(comfyPageFixture, webSocketFixture)

const still = { filename: 'example.png', subfolder: '', type: 'input' }

async function addPreviewImage(comfyPage: ComfyPage) {
  await comfyPage.nodeOps.clearGraph()
  await comfyPage.searchBoxV2.addNode('Preview Image')
  return comfyPage.vueNodes.getFixtureByTitle('Preview Image')
}

async function choose(
  comfyPage: ComfyPage,
  node: VueNodeFixture,
  label: string
) {
  await comfyPage.contextMenu.openForVueNode(node.header)
  await comfyPage.contextMenu.clickMenuItemExact(label)
}

function outputReceived(comfyPage: ComfyPage, locatorId: string) {
  return comfyPage.page.evaluate(
    (id) => !!window.app!.nodeOutputs[id],
    locatorId
  )
}

test.describe('Node preview display', { tag: ['@vue-nodes', '@node'] }, () => {
  test('Show Preview Zone reserves an empty preview before the first run, and the first output fills it at the size the user chose without the node resizing', async ({
    comfyPage,
    getWebSocket
  }) => {
    const node = await addPreviewImage(comfyPage)
    const zone = node.root.getByTestId('node-preview-region')
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())

    await test.step('the zone appears empty before any run', async () => {
      await expect(zone).toBeHidden()
      await choose(comfyPage, node, 'Show Preview Zone')
      await expect(zone).toBeVisible()
      await expect(zone.getByRole('img')).toHaveCount(0)
    })

    const zoneHeight = await heightOf(zone)

    await test.step('the user drags the zone taller', async () => {
      await node.dragHandle(node.growableRegionHandle(zone), 0, 60)
      await expect.poll(() => heightOf(zone)).toBeCloseTo(zoneHeight + 60, 0)
    })

    const nodeBox = await requireBoundingBox(node.root)
    const sizedZoneHeight = await heightOf(zone)

    await test.step('the first output fills the zone', async () => {
      execution.executed('first-run', '1', { images: [still] })
      await node.waitForImageLoaded('example.png')
      expect(await heightOf(zone)).toBeCloseTo(sizedZoneHeight, 0)
      const filledBox = await requireBoundingBox(node.root)
      expect(filledBox.width).toBeCloseTo(nodeBox.width, 0)
      expect(filledBox.height).toBeCloseTo(nodeBox.height, 0)
    })
  })

  test('Hide Preview keeps a node’s outputs and live frames from showing, and Show Preview Automatically brings back the latest output right away', async ({
    comfyPage,
    getWebSocket
  }) => {
    const node = await addPreviewImage(comfyPage)
    const gallery = node.root.getByRole('region', { name: /Image preview/ })
    const liveFrame = node.root.getByRole('img', {
      name: 'Live sampling preview'
    })
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())

    await choose(comfyPage, node, 'Hide Preview')
    execution.executed('hidden-run', '1', { images: [still] })
    execution.latentPreview('hidden-run', '1')
    await expect.poll(() => outputReceived(comfyPage, '1')).toBe(true)

    await expect(gallery).toBeHidden()
    await expect(liveFrame).toBeHidden()

    await choose(comfyPage, node, 'Show Preview Automatically')
    await expect(gallery).toBeVisible()
    await node.waitForImageLoaded('example.png')
  })

  test('A video output fills a preview zone the user made shorter, without the zone growing back', async ({
    comfyPage,
    getWebSocket
  }) => {
    const video = 'video-preview-wide.webm'
    await mockViewFiles(comfyPage.page, {
      [video]: { path: assetPath(`video/${video}`), contentType: 'video/webm' }
    })
    const node = await addPreviewImage(comfyPage)
    const zone = node.root.getByTestId('node-preview-region')
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())

    await choose(comfyPage, node, 'Show Preview Zone')
    const defaultHeight = await heightOf(zone)
    await node.dragHandle(node.growableRegionHandle(zone), 0, -100)
    await expect.poll(() => heightOf(zone)).toBeCloseTo(defaultHeight - 100, 0)
    const shortHeight = await heightOf(zone)

    execution.executed('video-run', '1', {
      images: [{ filename: video, subfolder: '', type: 'output' }]
    })
    await expect
      .poll(() =>
        zone
          .getByTestId('main-video')
          .evaluate(
            (element: HTMLVideoElement) =>
              element.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          )
      )
      .toBe(true)
    expect(await heightOf(zone)).toBeCloseTo(shortHeight, 0)
  })

  test('A resized preview zone survives saving and reopening the workflow, and undo and redo', async ({
    comfyPage
  }) => {
    const node = await addPreviewImage(comfyPage)
    const zone = node.root.getByTestId('node-preview-region')
    await choose(comfyPage, node, 'Show Preview Zone')
    const defaultHeight = await heightOf(zone)
    await node.dragHandle(node.growableRegionHandle(zone), 0, 60)
    await expect.poll(() => heightOf(zone)).toBeCloseTo(defaultHeight + 60, 0)

    await test.step('undo and redo step through the resize and the zone', async () => {
      await comfyPage.keyboard.undo()
      await expect.poll(() => heightOf(zone)).toBeCloseTo(defaultHeight, 0)
      await comfyPage.keyboard.undo()
      await expect(zone).toBeHidden()
      await comfyPage.keyboard.redo()
      await expect(zone).toBeVisible()
      await comfyPage.keyboard.redo()
      await expect.poll(() => heightOf(zone)).toBeCloseTo(defaultHeight + 60, 0)
    })

    await test.step('saving and reopening keeps the zone at its size', async () => {
      const workflow = await comfyPage.workflow.getExportedWorkflow()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.loadGraphData(workflow)
      const reopened = comfyPage.vueNodes
        .getNodeByTitle('Preview Image')
        .getByTestId('node-preview-region')
      await expect(reopened).toBeVisible()
      await expect
        .poll(() => heightOf(reopened))
        .toBeCloseTo(defaultHeight + 60, 0)
    })
  })

  test('A hidden preview stays hidden after saving and reopening the workflow, and undo and redo switch it', async ({
    comfyPage,
    getWebSocket
  }) => {
    const node = await addPreviewImage(comfyPage)
    const gallery = node.root.getByRole('region', { name: /Image preview/ })
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    execution.executed('first-run', '1', { images: [still] })
    await expect(gallery).toBeVisible()

    await test.step('undo and redo switch the hidden setting', async () => {
      await choose(comfyPage, node, 'Hide Preview')
      await expect(gallery).toBeHidden()
      await comfyPage.keyboard.undo()
      await expect(gallery).toBeVisible()
      await comfyPage.keyboard.redo()
      await expect(gallery).toBeHidden()
    })

    await test.step('saving and reopening keeps the preview hidden', async () => {
      const workflow = await comfyPage.workflow.getExportedWorkflow()
      await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
      await comfyPage.workflow.loadGraphData(workflow)
      execution.executed('reopened-run', '1', { images: [still] })
      await expect.poll(() => outputReceived(comfyPage, '1')).toBe(true)
      await expect(
        comfyPage.vueNodes
          .getNodeByTitle('Preview Image')
          .getByRole('region', { name: /Image preview/ })
      ).toBeHidden()
    })
  })
})

test.describe('Canvas node preview display', { tag: ['@node'] }, () => {
  async function addCanvasPreviewImage(comfyPage: ComfyPage) {
    await comfyPage.nodeOps.clearGraph()
    await comfyPage.searchBoxV2.addNode('Preview Image')
    const [node] = await comfyPage.nodeOps.getNodeRefsByType('PreviewImage')
    return node
  }

  function canvasNodeState(comfyPage: ComfyPage, id: NodeId) {
    return comfyPage.page.evaluate((nodeId) => {
      const node = window.app!.graph.getNodeById(nodeId)!
      return {
        size: [...node.size],
        drawsPreview: !!node.widgets?.some(
          (widget) => widget.name === '$$canvas-image-preview'
        ),
        images: node.imgs?.length ?? 0
      }
    }, id)
  }

  test('Show Preview Zone on a canvas node reserves room before the first run, and the first output fills it without the node resizing', async ({
    comfyPage,
    getWebSocket
  }) => {
    const node = await addCanvasPreviewImage(comfyPage)
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const before = await canvasNodeState(comfyPage, node.id)

    await node.clickContextMenuOption('Show Preview Zone')
    await expect
      .poll(async () => (await canvasNodeState(comfyPage, node.id)).size[1])
      .toBeGreaterThan(before.size[1] + 200)
    const reserved = await canvasNodeState(comfyPage, node.id)

    execution.executed('first-run', String(node.id), { images: [still] })
    execution.executing('first-run', null)
    await expect
      .poll(async () => (await canvasNodeState(comfyPage, node.id)).images)
      .toBe(1)
    expect((await canvasNodeState(comfyPage, node.id)).size).toEqual(
      reserved.size
    )
  })

  test('Hide Preview keeps a canvas node from drawing its outputs, and automatic draws the latest output right away', async ({
    comfyPage,
    getWebSocket
  }) => {
    const node = await addCanvasPreviewImage(comfyPage)
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())

    await node.clickContextMenuOption('Hide Preview')
    execution.executed('hidden-run', String(node.id), { images: [still] })
    execution.executing('hidden-run', null)
    await expect
      .poll(() => outputReceived(comfyPage, String(node.id)))
      .toBe(true)
    await comfyPage.nextFrame()
    expect((await canvasNodeState(comfyPage, node.id)).drawsPreview).toBe(false)

    await node.clickContextMenuOption('Show Preview Automatically')
    await expect
      .poll(async () => {
        const state = await canvasNodeState(comfyPage, node.id)
        return state.drawsPreview && state.images === 1
      })
      .toBe(true)
  })

  test('Show Preview Automatically drops the empty preview zone a canvas node reserved', async ({
    comfyPage
  }) => {
    const node = await addCanvasPreviewImage(comfyPage)

    await node.clickContextMenuOption('Show Preview Zone')
    await expect
      .poll(
        async () => (await canvasNodeState(comfyPage, node.id)).drawsPreview
      )
      .toBe(true)

    await node.clickContextMenuOption('Show Preview Automatically')
    await expect
      .poll(
        async () => (await canvasNodeState(comfyPage, node.id)).drawsPreview
      )
      .toBe(false)
  })

  test('Show Preview Automatically brings back a canvas node’s hidden video', async ({
    comfyPage,
    getWebSocket
  }) => {
    const video = 'video-preview-wide.webm'
    await mockViewFiles(comfyPage.page, {
      [video]: { path: assetPath(`video/${video}`), contentType: 'video/webm' }
    })
    const execution = new ExecutionHelper(comfyPage, await getWebSocket())
    const node = await comfyPage.nodeOps.addNode('SaveVideo', undefined, {
      x: 300,
      y: 150
    })
    const shown = { decoded: true, portrait: false }

    execution.executed('video-run', String(node.id), output(video))
    execution.executing('video-run', null)
    await expect.poll(() => canvasVideo(comfyPage.page)).toEqual(shown)

    await node.clickContextMenuOption('Hide Preview')
    await expect.poll(() => canvasVideo(comfyPage.page)).toBeNull()

    await node.clickContextMenuOption('Show Preview Automatically')
    await expect.poll(() => canvasVideo(comfyPage.page)).toEqual(shown)
  })
})
