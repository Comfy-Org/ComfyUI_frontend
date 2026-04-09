import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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

async function clickMinimapAt(
  overlay: Locator,
  page: Page,
  relX: number,
  relY: number
) {
  const box = await overlay.boundingBox()
  expect(box, 'Minimap interaction overlay not found').toBeTruthy()

  // Click area — avoiding the settings button (top-left, 32×32px)
  // and close button (top-right, 32×32px)
  await page.mouse.click(
    box!.x + box!.width * relX,
    box!.y + box!.height * relY
  )
}

test.describe('Minimap', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.waitForFunction(() => window.app && window.app.canvas)
  })

  test('Validate minimap is visible by default', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.getByTestId(
      TestIds.canvas.minimapContainer
    )

    await expect(minimapContainer).toBeVisible()

    const minimapCanvas = minimapContainer.getByTestId(
      TestIds.canvas.minimapCanvas
    )
    await expect(minimapCanvas).toBeVisible()

    const minimapViewport = minimapContainer.getByTestId(
      TestIds.canvas.minimapViewport
    )
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

    const minimapContainer = comfyPage.page.getByTestId(
      TestIds.canvas.minimapContainer
    )
    await expect(minimapContainer).toBeVisible()
  })

  test('Validate minimap can be toggled off and on', async ({ comfyPage }) => {
    const minimapContainer = comfyPage.page.getByTestId(
      TestIds.canvas.minimapContainer
    )
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
    const minimapContainer = comfyPage.page.getByTestId(
      TestIds.canvas.minimapContainer
    )

    await expect(minimapContainer).toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await expect(minimapContainer).toBeHidden()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await expect(minimapContainer).toBeVisible()
  })

  test('Close button hides minimap', async ({ comfyPage }) => {
    const minimap = comfyPage.page.getByTestId(TestIds.canvas.minimapContainer)
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
      const minimap = comfyPage.page.getByTestId(
        TestIds.canvas.minimapContainer
      )
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
    const minimapCanvas = comfyPage.page.getByTestId(
      TestIds.canvas.minimapCanvas
    )
    await expect(minimapCanvas).toBeVisible()

    await expect.poll(() => hasCanvasContent(minimapCanvas)).toBe(true)
  })

  test('Minimap canvas is empty after all nodes are deleted', async ({
    comfyPage
  }) => {
    const minimapCanvas = comfyPage.page.getByTestId(
      TestIds.canvas.minimapCanvas
    )
    await expect(minimapCanvas).toBeVisible()

    await comfyPage.keyboard.selectAll()
    await comfyPage.vueNodes.deleteSelected()
    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    await expect.poll(() => hasCanvasContent(minimapCanvas)).toBe(false)
  })

  test('Clicking minimap corner pans the main canvas', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.getByTestId(TestIds.canvas.minimapContainer)
    const viewport = minimap.getByTestId(TestIds.canvas.minimapViewport)
    const overlay = comfyPage.page.getByTestId(
      TestIds.canvas.minimapInteractionOverlay
    )
    await expect(minimap).toBeVisible()

    const before = await comfyPage.page.evaluate(() => ({
      x: window.app!.canvas.ds.offset[0],
      y: window.app!.canvas.ds.offset[1]
    }))

    const transformBefore = await viewport.evaluate(
      (el: HTMLElement) => el.style.transform
    )

    await clickMinimapAt(overlay, comfyPage.page, 0.15, 0.85)

    await expect
      .poll(() =>
        comfyPage.page.evaluate(() => ({
          x: window.app!.canvas.ds.offset[0],
          y: window.app!.canvas.ds.offset[1]
        }))
      )
      .not.toStrictEqual(before)

    await expect
      .poll(() => viewport.evaluate((el: HTMLElement) => el.style.transform))
      .not.toBe(transformBefore)
  })

  test('Clicking minimap center after FitView causes minimal canvas movement', async ({
    comfyPage
  }) => {
    const minimap = comfyPage.page.getByTestId(TestIds.canvas.minimapContainer)
    const overlay = comfyPage.page.getByTestId(
      TestIds.canvas.minimapInteractionOverlay
    )
    const viewport = minimap.getByTestId(TestIds.canvas.minimapViewport)
    await expect(minimap).toBeVisible()

    await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      canvas.ds.offset[0] -= 1000
      canvas.setDirty(true, true)
    })
    await comfyPage.nextFrame()

    const transformBefore = await viewport.evaluate(
      (el: HTMLElement) => el.style.transform
    )

    await comfyPage.page.evaluate(() => {
      window.app!.canvas.fitViewToSelectionAnimated({ duration: 1 })
    })

    await expect
      .poll(() => viewport.evaluate((el: HTMLElement) => el.style.transform), {
        timeout: 2000
      })
      .not.toBe(transformBefore)

    await comfyPage.nextFrame()

    const before = await comfyPage.page.evaluate(() => ({
      x: window.app!.canvas.ds.offset[0],
      y: window.app!.canvas.ds.offset[1]
    }))

    await clickMinimapAt(overlay, comfyPage.page, 0.5, 0.5)
    await comfyPage.nextFrame()

    const after = await comfyPage.page.evaluate(() => ({
      x: window.app!.canvas.ds.offset[0],
      y: window.app!.canvas.ds.offset[1]
    }))

    // ~3px overlay error × ~15 canvas/minimap scale ≈ 45, rounded up
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

  test(
    'Viewport rectangle is visible and positioned within minimap',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const minimap = comfyPage.page.getByTestId(
        TestIds.canvas.minimapContainer
      )
      await expect(minimap).toBeVisible()

      const viewport = minimap.getByTestId(TestIds.canvas.minimapViewport)
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
