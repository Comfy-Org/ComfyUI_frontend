import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '../fixtures/ComfyPage'
import { comfyPageFixture as test } from '../fixtures/ComfyPage'

// ---- Helpers ---------------------------------------------------------------

function createTestImageDataUrl(
  width: number,
  height: number,
  color: string
): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${color}"/>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

type Bounds = { x: number; y: number; width: number; height: number }

/**
 * Injects an image into the node output store for the given source node,
 * simulating what happens after a node executes and produces image output.
 */
async function injectSourceImage(
  page: Page,
  sourceNodeId: number,
  dataUrl: string
): Promise<void> {
  await page.evaluate(
    ({ nodeId, url }) => {
      type NodeOutputStore = {
        setNodePreviewsByNodeId: (id: number, urls: string[]) => void
      }
      type VueAppElement = HTMLElement & {
        __vue_app__: {
          config: {
            globalProperties: {
              $pinia: { _s: Map<string, NodeOutputStore> }
            }
          }
        }
      }
      const el = document.getElementById('vue-app') as unknown as VueAppElement
      const store =
        el.__vue_app__.config.globalProperties.$pinia._s.get('nodeOutput')!
      store.setNodePreviewsByNodeId(nodeId, [url])
    },
    { nodeId: sourceNodeId, url: dataUrl }
  )
}

async function setCropState(page: Page, bounds: Bounds): Promise<void> {
  await page.evaluate((bounds) => {
    type BoundsValue = { x: number; y: number; width: number; height: number }
    const node = window.app!.graph.getNodeById(1)
    const widget = node?.widgets?.find((w) => w.type === 'imagecrop')
    if (widget?.value) {
      const value = widget.value as unknown as BoundsValue
      value.x = bounds.x
      value.y = bounds.y
      value.width = bounds.width
      value.height = bounds.height
      widget.callback?.(widget.value)
    }
  }, bounds)
}

async function getCropState(page: Page): Promise<Bounds> {
  return page.evaluate(() => {
    type BoundsValue = { x: number; y: number; width: number; height: number }
    const node = window.app!.graph.getNodeById(1)
    const widget = node?.widgets?.find((w) => w.type === 'imagecrop')
    const v = widget?.value as unknown as BoundsValue
    return { x: v.x, y: v.y, width: v.width, height: v.height }
  })
}

/**
 * Injects a test image into the source node and waits for the crop widget to
 * be fully ready: image loaded, scale factor computed, crop box visible.
 */
async function setupWithImage(
  comfyPage: ComfyPage,
  imageWidth: number,
  imageHeight: number,
  initialBounds: Bounds
): Promise<void> {
  await injectSourceImage(
    comfyPage.page,
    2,
    createTestImageDataUrl(imageWidth, imageHeight, 'steelblue')
  )
  const node = comfyPage.vueNodes.getNodeLocator('1')
  await expect(node.locator('img')).toBeVisible()
  await comfyPage.page.waitForFunction(() => {
    const img = document.querySelector(
      '[data-node-id="1"] img'
    ) as HTMLImageElement | null
    return (img?.complete ?? false) && (img?.naturalWidth ?? 0) > 0
  })
  await setCropState(comfyPage.page, initialBounds)
  await comfyPage.nextFrame()
  await expect(node.locator('.cursor-move')).toBeVisible()
}

/**
 * Returns a locator for one of the 8 resize handles on the crop widget.
 * Handles are ordered in DOM as: top, bottom, left, right, nw, ne, sw, se.
 */
function getResizeHandle(
  nodeLocator: Locator,
  direction: 'top' | 'bottom' | 'left' | 'right' | 'nw' | 'ne' | 'sw' | 'se'
): Locator {
  switch (direction) {
    case 'top':
      return nodeLocator.locator('.cursor-ns-resize').first()
    case 'bottom':
      return nodeLocator.locator('.cursor-ns-resize').last()
    case 'left':
      return nodeLocator.locator('.cursor-ew-resize').first()
    case 'right':
      return nodeLocator.locator('.cursor-ew-resize').last()
    case 'nw':
      return nodeLocator.locator('.cursor-nwse-resize').first()
    case 'se':
      return nodeLocator.locator('.cursor-nwse-resize').last()
    case 'ne':
      return nodeLocator.locator('.cursor-nesw-resize').first()
    case 'sw':
      return nodeLocator.locator('.cursor-nesw-resize').last()
  }
}

async function dragFrom(
  page: Page,
  locator: Locator,
  deltaX: number,
  deltaY: number
): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  const startX = box!.x + box!.width / 2
  const startY = box!.y + box!.height / 2
  await page.mouse.move(startX, startY)
  await page.mouse.down()
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 10 })
  await page.mouse.up()
}

// ---- Tests -----------------------------------------------------------------

test.describe('Image Crop', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/image_crop_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'shows empty state when no input image is available',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()
      await expect(node).toContainText('No input image connected')
      await expect(node.locator('.cursor-move')).not.toBeVisible()
    }
  )

  test(
    'enforces minimum node size of 300×450',
    { tag: '@node' },
    async ({ comfyPage }) => {
      const size = await comfyPage.page.evaluate(() => {
        const node = window.app!.graph.getNodeById(1)
        return node?.size as [number, number]
      })
      expect(size[0]).toBeGreaterThanOrEqual(300)
      expect(size[1]).toBeGreaterThanOrEqual(450)
    }
  )

  test.describe('drag', { tag: '@widget' }, () => {
    test('moves the crop box', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 100,
        y: 100,
        width: 200,
        height: 200
      })

      const cropBox = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.cursor-move')
      await dragFrom(comfyPage.page, cropBox, 100, 0)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.x).toBeGreaterThan(100)
      expect(state.y).toBe(100)
      expect(state.width).toBe(200)
      expect(state.height).toBe(200)
    })

    test('clamps to right boundary', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 550,
        y: 100,
        width: 200,
        height: 200
      })

      const cropBox = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.cursor-move')
      await dragFrom(comfyPage.page, cropBox, 500, 0)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.x + state.width).toBeLessThanOrEqual(800)
    })

    test('clamps to top-left boundary', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 50,
        y: 50,
        width: 200,
        height: 200
      })

      const cropBox = comfyPage.vueNodes
        .getNodeLocator('1')
        .locator('.cursor-move')
      await dragFrom(comfyPage.page, cropBox, -500, -500)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.x).toBeGreaterThanOrEqual(0)
      expect(state.y).toBeGreaterThanOrEqual(0)
    })

    test('does nothing when no image is loaded', async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node.locator('.cursor-move')).not.toBeVisible()

      const stateBefore = await getCropState(comfyPage.page)

      const nodeBox = await node.boundingBox()
      if (nodeBox) {
        await comfyPage.page.mouse.click(
          nodeBox.x + nodeBox.width / 2,
          nodeBox.y + nodeBox.height / 2
        )
      }
      await comfyPage.nextFrame()

      const stateAfter = await getCropState(comfyPage.page)
      expect(stateAfter).toEqual(stateBefore)
    })
  })

  test.describe('free resize', { tag: '@widget' }, () => {
    test('right edge increases width', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 100,
        y: 100,
        width: 200,
        height: 200
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await dragFrom(comfyPage.page, getResizeHandle(node, 'right'), 80, 0)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.width).toBeGreaterThan(200)
      expect(state.x).toBe(100)
      expect(state.y).toBe(100)
      expect(state.height).toBe(200)
    })

    test('left edge adjusts x and width', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 200,
        y: 100,
        width: 300,
        height: 200
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await dragFrom(comfyPage.page, getResizeHandle(node, 'left'), -80, 0)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.x).toBeLessThan(200)
      expect(state.width).toBeGreaterThan(300)
      expect(state.y).toBe(100)
      expect(state.height).toBe(200)
    })

    test('bottom edge increases height', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 100,
        y: 100,
        width: 200,
        height: 200
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await dragFrom(comfyPage.page, getResizeHandle(node, 'bottom'), 0, 80)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.height).toBeGreaterThan(200)
      expect(state.x).toBe(100)
      expect(state.y).toBe(100)
      expect(state.width).toBe(200)
    })

    test('top edge adjusts y and height', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 100,
        y: 200,
        width: 200,
        height: 200
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await dragFrom(comfyPage.page, getResizeHandle(node, 'top'), 0, -80)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.y).toBeLessThan(200)
      expect(state.height).toBeGreaterThan(200)
      expect(state.x).toBe(100)
      expect(state.width).toBe(200)
    })

    test('SE corner increases width and height', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 100,
        y: 100,
        width: 200,
        height: 200
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await dragFrom(comfyPage.page, getResizeHandle(node, 'se'), 80, 80)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.width).toBeGreaterThan(200)
      expect(state.height).toBeGreaterThan(200)
      expect(state.x).toBe(100)
      expect(state.y).toBe(100)
    })

    test('NW corner adjusts x, y, width, and height', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 200,
        y: 200,
        width: 200,
        height: 200
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      await dragFrom(comfyPage.page, getResizeHandle(node, 'nw'), -80, -80)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.x).toBeLessThan(200)
      expect(state.y).toBeLessThan(200)
      expect(state.width).toBeGreaterThan(200)
      expect(state.height).toBeGreaterThan(200)
    })

    test('enforces minimum crop size of 16px', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 100,
        y: 100,
        width: 50,
        height: 50
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      // Drag right edge far left to try to collapse width below the minimum
      await dragFrom(comfyPage.page, getResizeHandle(node, 'right'), -500, 0)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.width).toBeGreaterThanOrEqual(16)
    })

    test('clamps resize to image boundary', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 600,
        y: 100,
        width: 100,
        height: 200
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      // Drag right edge far past the image right boundary
      await dragFrom(comfyPage.page, getResizeHandle(node, 'right'), 500, 0)
      await comfyPage.nextFrame()

      const state = await getCropState(comfyPage.page)
      expect(state.x + state.width).toBeLessThanOrEqual(800)
    })

    test('shows 8 handles when ratio is unlocked', async ({ comfyPage }) => {
      await setupWithImage(comfyPage, 800, 600, {
        x: 100,
        y: 100,
        width: 200,
        height: 200
      })

      const node = comfyPage.vueNodes.getNodeLocator('1')
      const handles = node.locator(
        '.cursor-ns-resize, .cursor-ew-resize, .cursor-nwse-resize, .cursor-nesw-resize'
      )
      await expect(handles).toHaveCount(8)
    })
  })
})
