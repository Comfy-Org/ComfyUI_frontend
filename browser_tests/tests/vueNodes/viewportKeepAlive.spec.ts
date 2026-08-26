import {
  comfyExpect as expect,
  comfyPageFixture as test
} from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import largeGraphWorkflow from '@e2e/assets/large-graph-workflow.json' with { type: 'json' }
import type { Page } from '@playwright/test'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'

const LARGE_GRAPH_WORKFLOW = zComfyWorkflow.parse(largeGraphWorkflow)

async function setCanvasOffsetX(page: Page, offsetX: number): Promise<void> {
  await page.evaluate((x) => {
    const canvas = window.app!.canvas
    canvas.ds.offset[0] = x
    canvas.setDirty(true, true)
  }, offsetX)
}

async function setCanvasScale(comfyPage: ComfyPage, scale: number) {
  await comfyPage.canvasOps.setScale(scale)
  await comfyPage.nextFrame()
}

async function getGraphNodeSize(page: Page, nodeId: string) {
  return await page.evaluate((id) => {
    const node = window.app!.graph!.nodes.find(
      (candidate) => String(candidate.id) === id
    )
    if (!node) throw new Error(`Node ${id} is missing`)
    return Array.from(node.size)
  }, nodeId)
}

test.describe(
  'Vue node viewport KeepAlive',
  { tag: ['@canvas', '@node', '@vue-nodes', '@slow'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadGraphData(LARGE_GRAPH_WORKFLOW)
      await comfyPage.canvasOps.setScale(1)
      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.offset[0] = 0
        canvas.ds.offset[1] = 0
        canvas.setDirty(true, true)
      })
      await comfyPage.nextFrame()
      await comfyPage.vueNodes.waitForNodes()
    })

    test.afterEach(async ({ comfyPage }) => {
      await comfyPage.canvasOps.resetView()
    })

    test('detaches nodes and restores the same element without changing graph size', async ({
      comfyPage
    }) => {
      test.slow()
      const initialNode = comfyPage.vueNodes.nodes.first()
      await expect(initialNode).toBeVisible()
      const nodeId = await initialNode.getAttribute('data-node-id')
      const initialElement = await initialNode.elementHandle()
      if (!nodeId || !initialElement) {
        throw new Error('Expected an active Vue node with an id')
      }
      const initialSize = await getGraphNodeSize(comfyPage.page, nodeId)

      await setCanvasOffsetX(comfyPage.page, -100_000)

      await expect
        .poll(() => initialElement.evaluate((element) => element.isConnected))
        .toBe(false)
      await expect
        .poll(() => comfyPage.vueNodes.getNodeCount())
        .toBeLessThan(245)

      await setCanvasOffsetX(comfyPage.page, 0)

      const returnedNode = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(returnedNode).toBeVisible()
      const returnedElement = await returnedNode.elementHandle()
      if (!returnedElement) throw new Error('Expected the Vue node to return')

      expect(
        await initialElement.evaluate(
          (element, candidate) => element === candidate,
          returnedElement
        )
      ).toBe(true)
      expect(await getGraphNodeSize(comfyPage.page, nodeId)).toEqual(
        initialSize
      )
    })

    test('keeps the focused node connected while panning away', async ({
      comfyPage
    }) => {
      test.slow()
      const focusedNode = comfyPage.vueNodes.nodes.first()
      const focusedElement = await focusedNode.elementHandle()
      if (!focusedElement) throw new Error('Expected an active Vue node')
      await focusedNode.focus()

      await setCanvasOffsetX(comfyPage.page, -100_000)

      await expect
        .poll(() => focusedElement.evaluate((element) => element.isConnected))
        .toBe(true)
      expect(
        await focusedElement.evaluate((element) =>
          element.contains(document.activeElement)
        )
      ).toBe(true)
    })

    test('keeps a link-drag source connected while panning away', async ({
      comfyPage
    }) => {
      test.slow()
      const sourceNode = comfyPage.vueNodes.getNodeLocator('3')
      const outputSlot = sourceNode
        .locator('.lg-slot--output')
        .getByTestId('slot-connection-dot')
      await expect(outputSlot).toBeVisible()
      const sourceElement = await sourceNode.elementHandle()
      if (!sourceElement) throw new Error('Expected a link source node')

      await outputSlot.hover()
      await comfyPage.page.mouse.down()
      try {
        await comfyPage.page.evaluate(() => {
          window.app!.canvas.deselectAll()
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        })
        await expect
          .poll(() =>
            comfyPage.page.evaluate(
              () => window.app!.canvas.linkConnector.isConnecting
            )
          )
          .toBe(true)

        await setCanvasOffsetX(comfyPage.page, -100_000)

        await expect
          .poll(() => comfyPage.vueNodes.getNodeCount())
          .toBeLessThan(245)
        await expect
          .poll(() => sourceElement.evaluate((element) => element.isConnected))
          .toBe(true)

        await comfyPage.page.locator('#graph-canvas').press('Escape')
      } finally {
        await comfyPage.page.mouse.up()
      }

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            () => window.app!.canvas.linkConnector.isConnecting
          )
        )
        .toBe(false)
      await expect
        .poll(() => sourceElement.evaluate((element) => element.isConnected))
        .toBe(false)
    })

    test('uses boxes at low quality and restores the same node element', async ({
      comfyPage
    }) => {
      test.slow()
      const initialNode = comfyPage.vueNodes.nodes.first()
      const nodeId = await initialNode.getAttribute('data-node-id')
      const initialElement = await initialNode.elementHandle()
      if (!nodeId || !initialElement) {
        throw new Error('Expected an active Vue node with an id')
      }
      const initialSize = await getGraphNodeSize(comfyPage.page, nodeId)

      await setCanvasScale(comfyPage, 0.4)
      await expect(comfyPage.page.getByTestId('node-box-overlay')).toBeVisible()
      await expect
        .poll(() => initialElement.evaluate((element) => element.isConnected))
        .toBe(false)

      await setCanvasScale(comfyPage, 1)
      const returnedNode = comfyPage.vueNodes.getNodeLocator(nodeId)
      await expect(returnedNode).toBeVisible()
      const returnedElement = await returnedNode.elementHandle()
      if (!returnedElement) throw new Error('Expected the Vue node to return')

      expect(
        await initialElement.evaluate(
          (element, candidate) => element === candidate,
          returnedElement
        )
      ).toBe(true)
      expect(await getGraphNodeSize(comfyPage.page, nodeId)).toEqual(
        initialSize
      )
    })

    test('keeps the focused node connected in low-quality mode', async ({
      comfyPage
    }) => {
      test.slow()
      const focusedNode = comfyPage.vueNodes.nodes.first()
      const focusedElement = await focusedNode.elementHandle()
      if (!focusedElement) throw new Error('Expected an active Vue node')
      await focusedNode.focus()

      await setCanvasScale(comfyPage, 0.4)
      await expect(comfyPage.page.getByTestId('node-box-overlay')).toBeVisible()
      await expect
        .poll(() => focusedElement.evaluate((element) => element.isConnected))
        .toBe(true)
      expect(
        await focusedElement.evaluate((element) =>
          element.contains(document.activeElement)
        )
      ).toBe(true)
    })
  }
)
