import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

test.describe('Minimap', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
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
    await expect(minimapContainer).toBeHidden()

    await toggleButton.click()
    await expect(minimapContainer).toBeVisible()
  })

  test('Validate minimap keyboard shortcut Alt+M', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.locator('.litegraph-minimap')

    await expect(minimapContainer).toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await expect(minimapContainer).toBeHidden()

    await comfyPage.page.keyboard.press('Alt+KeyM')
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
      await comfyPage.nextFrame()
      await expect(minimap).toHaveScreenshot('minimap-after-pan.png')
    }
  )

  test('Minimap canvas is non-empty for a workflow with nodes', async ({
    comfyPage
  }) => {
    const minimapCanvas = comfyPage.page.locator('.minimap-canvas')
    await expect(minimapCanvas).toBeVisible()

    const hasContent = await minimapCanvas.evaluate(
      (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return false
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] > 0) return true
        }
        return false
      }
    )

    expect(hasContent).toBe(true)
  })

  test('Minimap canvas is empty after all nodes are deleted', async ({
    comfyPage
  }) => {
    const minimapCanvas = comfyPage.page.locator('.minimap-canvas')
    await expect(minimapCanvas).toBeVisible()

    await comfyPage.keyboard.selectAll()
    await comfyPage.vueNodes.deleteSelected()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount(), { timeout: 2000 })
      .toBe(0)

    await expect
      .poll(
        () =>
          minimapCanvas.evaluate((canvas: HTMLCanvasElement) => {
            const ctx = canvas.getContext('2d')
            if (!ctx) return true
            const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
            for (let i = 3; i < data.length; i += 4) {
              if (data[i] > 0) return false
            }
            return true
          }),
        { timeout: 2000 }
      )
      .toBe(true)
  })

  test('Clicking minimap corner pans the main canvas', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    const overlay = comfyPage.page.getByTestId(
      TestIds.canvas.minimapInteractionOverlay
    )
    await expect(minimap).toBeVisible()

    const before = await comfyPage.page.evaluate(() => ({
      x: window.app!.canvas.ds.offset[0],
      y: window.app!.canvas.ds.offset[1]
    }))

    const box = await overlay.boundingBox()
    expect(box, 'Minimap interaction overlay not found').toBeTruthy()

    // Click bottom-left area — clear of the settings button (top-left, 32×32px)
    // and close button (top-right, 32×32px)
    await comfyPage.page.mouse.click(
      box!.x + box!.width * 0.15,
      box!.y + box!.height * 0.85
    )
    await comfyPage.nextFrame()

    const after = await comfyPage.page.evaluate(() => ({
      x: window.app!.canvas.ds.offset[0],
      y: window.app!.canvas.ds.offset[1]
    }))

    expect(
      after,
      'Canvas offset should change after clicking minimap corner'
    ).not.toStrictEqual(before)
  })

  test('Clicking minimap center after FitView causes minimal canvas movement', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    const overlay = comfyPage.page.getByTestId(
      TestIds.canvas.minimapInteractionOverlay
    )
    await expect(minimap).toBeVisible()

    await comfyPage.command.executeCommand('Comfy.Canvas.FitView')
    await comfyPage.nextFrame()

    const before = await comfyPage.page.evaluate(() => ({
      x: window.app!.canvas.ds.offset[0],
      y: window.app!.canvas.ds.offset[1]
    }))

    const box = await overlay.boundingBox()
    expect(box, 'Minimap interaction overlay not found').toBeTruthy()

    await comfyPage.page.mouse.click(
      box!.x + box!.width / 2,
      box!.y + box!.height / 2
    )
    await comfyPage.nextFrame()

    const after = await comfyPage.page.evaluate(() => ({
      x: window.app!.canvas.ds.offset[0],
      y: window.app!.canvas.ds.offset[1]
    }))

    // Clicking the minimap center maps to approximately the center of the node
    // bounds, which FitView also centers on. A small residual offset is expected
    // due to the 250px (logical) vs 253px (CSS) width discrepancy in the overlay.
    const TOLERANCE = 50
    expect(
      Math.abs(after.x - before.x),
      `offset.x changed by more than ${TOLERANCE} after clicking minimap center post-FitView`
    ).toBeLessThan(TOLERANCE)
    expect(
      Math.abs(after.y - before.y),
      `offset.y changed by more than ${TOLERANCE} after clicking minimap center post-FitView`
    ).toBeLessThan(TOLERANCE)
  })

  test('Viewport rectangle updates after minimap click', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.locator('.litegraph-minimap')
    const viewport = minimap.locator('.minimap-viewport')
    const overlay = comfyPage.page.getByTestId(
      TestIds.canvas.minimapInteractionOverlay
    )
    await expect(minimap).toBeVisible()

    const transformBefore = await viewport.evaluate(
      (el: HTMLElement) => el.style.transform
    )

    const box = await overlay.boundingBox()
    expect(box, 'Minimap interaction overlay not found').toBeTruthy()

    // Click bottom-left area — clear of the settings button (top-left, 32×32px)
    // and close button (top-right, 32×32px)
    await comfyPage.page.mouse.click(
      box!.x + box!.width * 0.15,
      box!.y + box!.height * 0.85
    )
    await comfyPage.nextFrame()

    await expect
      .poll(() => viewport.evaluate((el: HTMLElement) => el.style.transform), {
        timeout: 1000
      })
      .not.toBe(transformBefore)
  })

  test(
    'Viewport rectangle is visible and positioned within minimap',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const minimap = comfyPage.page.locator('.litegraph-minimap')
      await expect(minimap).toBeVisible()

      const viewport = minimap.locator('.minimap-viewport')
      await expect(viewport).toBeVisible()

      await expect(async () => {
        const vb = await viewport.boundingBox()
        const mb = await minimap.boundingBox()
        expect(vb).toBeTruthy()
        expect(mb).toBeTruthy()
        expect(vb!.width).toBeGreaterThan(0)
        expect(vb!.height).toBeGreaterThan(0)
        expect(vb!.x).toBeGreaterThanOrEqual(mb!.x)
        expect(vb!.y).toBeGreaterThanOrEqual(mb!.y)
        expect(vb!.x + vb!.width).toBeLessThanOrEqual(mb!.x + mb!.width)
        expect(vb!.y + vb!.height).toBeLessThanOrEqual(mb!.y + mb!.height)
      }).toPass({ timeout: 5000 })

      await expect(minimap).toHaveScreenshot('minimap-with-viewport.png')
    }
  )
})
