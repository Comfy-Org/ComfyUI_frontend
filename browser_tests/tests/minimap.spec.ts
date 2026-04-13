import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

function hasCanvasContent(canvas: Locator): Promise<boolean> {
  return canvas.evaluate((el: HTMLCanvasElement) => {
    const ctx = el.getContext('2d')
    if (!ctx) return false
    const { data } = ctx.getImageData(0, 0, el.width, el.height)
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 0) return true
    }
    return false
  })
}

test.describe('Minimap', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.waitForFunction(() => window.app && window.app.canvas)
  })

  test('Validate minimap is visible by default', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')

    await expect(minimapContainer).toBeVisible()

    const minimapCanvas = minimapContainer.locator('.minimap-canvas')
    await expect(minimapCanvas).toBeVisible()

    const minimapViewport = minimapContainer.locator('.minimap-viewport')
    await expect(minimapViewport).toBeVisible()

    await expect(minimapContainer).toHaveCSS('position', 'relative')

    // position and z-index validation moved to the parent container of the minimap
    const minimapMainContainer = comfyPage.page.locator(
      '.minimap-main-container'
    )
    await expect(minimapMainContainer).toHaveCSS('position', 'absolute')
    await expect(minimapMainContainer).toHaveCSS('z-index', '1000')
  })

  test('Validate minimap toggle button state', async ({ comfyPage }) => {
    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )

    await expect(toggleButton).toBeVisible()

    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimapContainer).toBeVisible()
  })

  test('Validate minimap can be toggled off and on', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')
    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )

    await expect(minimapContainer).toBeVisible()

    await toggleButton.click()
    await comfyPage.nextFrame()

    await expect(minimapContainer).toBeHidden()

    await toggleButton.click()
    await comfyPage.nextFrame()

    await expect(minimapContainer).toBeVisible()
  })

  test('Validate minimap keyboard shortcut Alt+M', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')

    await expect(minimapContainer).toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await comfyPage.nextFrame()

    await expect(minimapContainer).toBeHidden()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await comfyPage.nextFrame()

    await expect(minimapContainer).toBeVisible()
  })

  test('Close button hides minimap', async ({ comfyPage }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap).toBeVisible()

    await comfyPage.page.getByTestId(TestIds.canvas.closeMinimapButton).click()
    await expect(minimap).toBeHidden()

    const toggleButton = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )
    await expect(toggleButton).toBeVisible()
  })

  test(
    'Panning canvas moves minimap viewport',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const minimap = comfyPage.page.locator('.litegraph-minimap')
      await expect(minimap).toBeVisible()

      await expect(minimap).toHaveScreenshot('minimap-before-pan.png')

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.scale = 3
        canvas.ds.offset[0] = -800
        canvas.ds.offset[1] = -600
        canvas.setDirty(true, true)
      })
      await expect(minimap).toHaveScreenshot('minimap-after-pan.png')
    }
  )

  test(
    'Viewport rectangle is visible and positioned within minimap',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const minimap = comfyPage.page.locator('.litegraph-minimap')
      await expect(minimap).toBeVisible()

      const viewport = minimap.locator('.minimap-viewport')
      await expect(viewport).toBeVisible()

      const minimapBox = await minimap.boundingBox()
      const viewportBox = await viewport.boundingBox()

      expect(minimapBox).toBeTruthy()
      expect(viewportBox).toBeTruthy()
      expect(viewportBox!.width).toBeGreaterThan(0)
      expect(viewportBox!.height).toBeGreaterThan(0)

      expect(viewportBox!.x + viewportBox!.width).toBeGreaterThan(minimapBox!.x)
      expect(viewportBox!.y + viewportBox!.height).toBeGreaterThan(
        minimapBox!.y
      )
      expect(viewportBox!.x).toBeLessThan(minimapBox!.x + minimapBox!.width)
      expect(viewportBox!.y).toBeLessThan(minimapBox!.y + minimapBox!.height)

      await expect(minimap).toHaveScreenshot('minimap-with-viewport.png')
    }
  )

  test('Clicking on minimap pans the canvas to that position', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap).toBeVisible()

    const offsetBefore = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas.ds
      return [ds.offset[0], ds.offset[1]]
    })

    const minimapBox = await minimap.boundingBox()
    expect(minimapBox).toBeTruthy()

    // Click the top-left quadrant — canvas should pan so that region
    // becomes centered, meaning offset increases (moves right/down)
    await comfyPage.page.mouse.click(
      minimapBox!.x + minimapBox!.width * 0.2,
      minimapBox!.y + minimapBox!.height * 0.2
    )
    await comfyPage.nextFrame()

    await expect
      .poll(async () => {
        const ds = await comfyPage.page.evaluate(() => {
          const d = window.app!.canvas.ds
          return [d.offset[0], d.offset[1]]
        })
        return ds
      })
      .not.toEqual(offsetBefore)
  })

  test('Dragging on minimap continuously pans the canvas', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap).toBeVisible()

    const minimapBox = await minimap.boundingBox()
    expect(minimapBox).toBeTruthy()

    const startX = minimapBox!.x + minimapBox!.width * 0.3
    const startY = minimapBox!.y + minimapBox!.height * 0.3
    const endX = minimapBox!.x + minimapBox!.width * 0.7
    const endY = minimapBox!.y + minimapBox!.height * 0.7

    const offsetBefore = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas.ds
      return [ds.offset[0], ds.offset[1]]
    })

    // Drag from top-left toward bottom-right on the minimap
    await comfyPage.page.mouse.move(startX, startY)
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(endX, endY, { steps: 10 })

    // Mid-drag: offset should already differ from initial state
    const offsetMidDrag = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas.ds
      return [ds.offset[0], ds.offset[1]]
    })
    expect(
      offsetMidDrag[0] !== offsetBefore[0] ||
        offsetMidDrag[1] !== offsetBefore[1]
    ).toBe(true)

    await comfyPage.page.mouse.up()
    await comfyPage.nextFrame()

    // Final offset should also differ (drag was not discarded on mouseup)
    await expect
      .poll(async () => {
        const ds = await comfyPage.page.evaluate(() => {
          const d = window.app!.canvas.ds
          return [d.offset[0], d.offset[1]]
        })
        return ds
      })
      .not.toEqual(offsetBefore)
  })

  test('Minimap viewport updates when canvas is zoomed', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap).toBeVisible()

    const viewport = minimap.locator('.minimap-viewport')
    await expect(viewport).toBeVisible()

    const viewportBefore = await viewport.boundingBox()
    expect(viewportBefore).toBeTruthy()

    // Zoom in significantly
    await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      canvas.ds.scale = 3
      canvas.setDirty(true, true)
    })
    await comfyPage.nextFrame()

    // Viewport rectangle should shrink when zoomed in
    await expect
      .poll(async () => {
        const box = await viewport.boundingBox()
        return box?.width ?? 0
      })
      .toBeLessThan(viewportBefore!.width)
  })

  test('Minimap canvas is empty after all nodes are deleted', async ({
    comfyPage
  }) => {
    const minimapCanvas = comfyPage.page.getByTestId(
      TestIds.canvas.minimapCanvas
    )
    await expect(minimapCanvas).toBeVisible()

    // Minimap should have content before deletion
    await expect.poll(() => hasCanvasContent(minimapCanvas)).toBe(true)

    // Remove all nodes
    await comfyPage.canvas.press('Control+a')
    await comfyPage.canvas.press('Delete')
    await comfyPage.nextFrame()

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    // Minimap canvas should be empty — no nodes means nothing to render
    await expect
      .poll(() => hasCanvasContent(minimapCanvas), { timeout: 5000 })
      .toBe(false)
  })

  test('Minimap re-renders after loading a different workflow', async ({
    comfyPage
  }) => {
    const minimapCanvas = comfyPage.page.getByTestId(
      TestIds.canvas.minimapCanvas
    )
    await expect(minimapCanvas).toBeVisible()

    // Default workflow has content
    await expect.poll(() => hasCanvasContent(minimapCanvas)).toBe(true)

    // Load a very different workflow
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await comfyPage.nextFrame()

    // Minimap should still have content (different workflow, still has nodes)
    await expect
      .poll(() => hasCanvasContent(minimapCanvas), { timeout: 5000 })
      .toBe(true)
  })

  test('Minimap viewport position reflects canvas pan state', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    await expect(minimap).toBeVisible()

    const viewport = minimap.locator('.minimap-viewport')
    await expect(viewport).toBeVisible()

    const positionBefore = await viewport.boundingBox()
    expect(positionBefore).toBeTruthy()

    // Pan the canvas by a large amount to the right and down
    await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      canvas.ds.offset[0] -= 500
      canvas.ds.offset[1] -= 500
      canvas.setDirty(true, true)
    })
    await comfyPage.nextFrame()

    // The viewport indicator should have moved within the minimap
    await expect
      .poll(async () => {
        const box = await viewport.boundingBox()
        if (!box || !positionBefore) return false
        return box.x !== positionBefore.x || box.y !== positionBefore.y
      })
      .toBe(true)
  })
})
