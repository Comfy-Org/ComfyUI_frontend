import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'
import {
  clientPointOnMinimapOverlay,
  MINIMAP_POINTER_OPTS,
  readMainCanvasOffset
} from '@e2e/fixtures/utils/minimapUtils'

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

function getMinimapLocators(comfyPage: ComfyPage) {
  const container = comfyPage.page.getByTestId(TestIds.canvas.minimapContainer)
  return {
    container,
    canvas: comfyPage.page.getByTestId(TestIds.canvas.minimapCanvas),
    viewport: comfyPage.page.getByTestId(TestIds.canvas.minimapViewport),
    toggleButton: comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    ),
    closeButton: comfyPage.page.getByTestId(TestIds.canvas.closeMinimapButton)
  }
}

async function clickMinimapAt(
  overlay: Locator,
  page: Page,
  relX: number,
  relY: number
) {
  const { clientX, clientY } = await clientPointOnMinimapOverlay(
    overlay,
    relX,
    relY
  )
  await page.mouse.click(clientX, clientY)
}

test.describe('Minimap', { tag: '@canvas' }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.waitForFunction(() => window.app && window.app.canvas)
  })

  test('Validate minimap is visible by default', async ({ comfyPage }) => {
    const { container, canvas, viewport } = getMinimapLocators(comfyPage)

    await expect(container).toBeVisible()
    await expect(canvas).toBeVisible()
    await expect(viewport).toBeVisible()

    await expect(container).toHaveCSS('position', 'relative')

    // position and z-index validation moved to the parent container of the minimap
    const minimapMainContainer = comfyPage.page.locator(
      '.minimap-main-container'
    )
    await expect(minimapMainContainer).toHaveCSS('position', 'absolute')
    await expect(minimapMainContainer).toHaveCSS('z-index', '1000')
  })

  test('Validate minimap toggle button state', async ({ comfyPage }) => {
    const { container, toggleButton } = getMinimapLocators(comfyPage)

    await expect(toggleButton).toBeVisible()
    await expect(container).toBeVisible()
  })

  test('Validate minimap can be toggled off and on', async ({ comfyPage }) => {
    const { container, toggleButton } = getMinimapLocators(comfyPage)

    await expect(container).toBeVisible()

    await toggleButton.click()
    await comfyPage.nextFrame()

    await expect(container).toBeHidden()

    await toggleButton.click()
    await comfyPage.nextFrame()

    await expect(container).toBeVisible()
  })

  test('Validate minimap keyboard shortcut Alt+M', async ({ comfyPage }) => {
    const { container } = getMinimapLocators(comfyPage)

    await expect(container).toBeVisible()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await comfyPage.nextFrame()

    await expect(container).toBeHidden()

    await comfyPage.page.keyboard.press('Alt+KeyM')
    await comfyPage.nextFrame()

    await expect(container).toBeVisible()
  })

  test('Close button hides minimap; toolbar toggle reopens it', async ({
    comfyPage
  }) => {
    const { container, viewport, toggleButton, closeButton } =
      getMinimapLocators(comfyPage)

    await expect(container).toBeVisible()

    await closeButton.click()
    await expect(container).toBeHidden()

    await expect
      .poll(() =>
        comfyPage.settings.getSetting<boolean>('Comfy.Minimap.Visible')
      )
      .toBe(false)

    await expect(toggleButton).toBeVisible()

    await toggleButton.click()
    await expect(container).toBeVisible()
    await expect(viewport).toBeVisible()

    await expect
      .poll(() =>
        comfyPage.settings.getSetting<boolean>('Comfy.Minimap.Visible')
      )
      .toBe(true)
  })

  test(
    'Panning canvas moves minimap viewport',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const { container } = getMinimapLocators(comfyPage)
      await expect(container).toBeVisible()

      await expect(container).toHaveScreenshot('minimap-before-pan.png')

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        canvas.ds.scale = 3
        canvas.ds.offset[0] = -800
        canvas.ds.offset[1] = -600
        canvas.setDirty(true, true)
      })
      await expect(container).toHaveScreenshot('minimap-after-pan.png')
    }
  )

  test(
    'Viewport rectangle is visible and positioned within minimap',
    { tag: '@screenshot' },
    async ({ comfyPage }) => {
      const { container, viewport } = getMinimapLocators(comfyPage)
      await expect(container).toBeVisible()
      await expect(viewport).toBeVisible()

      const minimapBox = await container.boundingBox()
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

      await expect(container).toHaveScreenshot('minimap-with-viewport.png')
    }
  )

  test('Clicking on minimap pans the canvas to that position', async ({
    comfyPage
  }) => {
    const { container } = getMinimapLocators(comfyPage)
    await expect(container).toBeVisible()

    const offsetBefore = await readMainCanvasOffset(comfyPage.page)

    const minimapBox = await container.boundingBox()
    expect(minimapBox).toBeTruthy()

    // Click the top-left quadrant — canvas should pan so that region
    // becomes centered, meaning offset increases (moves right/down)
    await comfyPage.page.mouse.click(
      minimapBox!.x + minimapBox!.width * 0.2,
      minimapBox!.y + minimapBox!.height * 0.2
    )
    await comfyPage.nextFrame()

    await expect
      .poll(() => readMainCanvasOffset(comfyPage.page))
      .not.toEqual(offsetBefore)
  })

  test('Clicking minimap center after FitView causes minimal canvas movement', async ({
    comfyPage
  }) => {
    const { container, viewport } = getMinimapLocators(comfyPage)
    const overlay = comfyPage.page.getByTestId(
      TestIds.canvas.minimapInteractionOverlay
    )
    await expect(container).toBeVisible()

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

  test('Dragging on minimap pans the main canvas progressively', async ({
    comfyPage
  }) => {
    const overlay = comfyPage.page.getByTestId(
      TestIds.canvas.minimapInteractionOverlay
    )
    const initial = await readMainCanvasOffset(comfyPage.page)

    const start = await clientPointOnMinimapOverlay(overlay, 0.48, 0.5)
    await overlay.dispatchEvent('pointerdown', {
      ...MINIMAP_POINTER_OPTS,
      clientX: start.clientX,
      clientY: start.clientY
    })
    await comfyPage.nextFrame()

    const firstMove = await clientPointOnMinimapOverlay(overlay, 0.35, 0.52)
    await overlay.dispatchEvent('pointermove', {
      ...MINIMAP_POINTER_OPTS,
      clientX: firstMove.clientX,
      clientY: firstMove.clientY
    })
    await expect
      .poll(() => readMainCanvasOffset(comfyPage.page))
      .not.toStrictEqual(initial)
    const afterFirstMove = await readMainCanvasOffset(comfyPage.page)

    const secondMove = await clientPointOnMinimapOverlay(overlay, 0.22, 0.55)
    await overlay.dispatchEvent('pointermove', {
      ...MINIMAP_POINTER_OPTS,
      clientX: secondMove.clientX,
      clientY: secondMove.clientY
    })
    await expect
      .poll(() => readMainCanvasOffset(comfyPage.page))
      .not.toStrictEqual(afterFirstMove)

    const upPoint = await clientPointOnMinimapOverlay(overlay, 0.18, 0.58)
    await overlay.dispatchEvent('pointerup', {
      ...MINIMAP_POINTER_OPTS,
      clientX: upPoint.clientX,
      clientY: upPoint.clientY
    })
    await comfyPage.nextFrame()

    const final = await readMainCanvasOffset(comfyPage.page)
    const panDistance =
      Math.abs(final.x - initial.x) + Math.abs(final.y - initial.y)
    expect(
      panDistance,
      'Expected drag from center toward lower-left on minimap to move the canvas meaningfully'
    ).toBeGreaterThan(40)
  })

  test('Minimap viewport transform updates during overlay drag', async ({
    comfyPage
  }) => {
    const { container, viewport } = getMinimapLocators(comfyPage)
    const overlay = comfyPage.page.getByTestId(
      TestIds.canvas.minimapInteractionOverlay
    )
    await expect(container).toBeVisible()

    const transformBefore = await viewport.evaluate(
      (el: HTMLElement) => el.style.transform
    )

    const start = await clientPointOnMinimapOverlay(overlay, 0.48, 0.5)
    await overlay.dispatchEvent('pointerdown', {
      ...MINIMAP_POINTER_OPTS,
      clientX: start.clientX,
      clientY: start.clientY
    })
    await comfyPage.nextFrame()

    const mid = await clientPointOnMinimapOverlay(overlay, 0.28, 0.52)
    await overlay.dispatchEvent('pointermove', {
      ...MINIMAP_POINTER_OPTS,
      clientX: mid.clientX,
      clientY: mid.clientY
    })

    await expect
      .poll(() => viewport.evaluate((el: HTMLElement) => el.style.transform))
      .not.toBe(transformBefore)

    const transformMid = await viewport.evaluate(
      (el: HTMLElement) => el.style.transform
    )

    const later = await clientPointOnMinimapOverlay(overlay, 0.18, 0.55)
    await overlay.dispatchEvent('pointermove', {
      ...MINIMAP_POINTER_OPTS,
      clientX: later.clientX,
      clientY: later.clientY
    })

    await expect
      .poll(() => viewport.evaluate((el: HTMLElement) => el.style.transform))
      .not.toBe(transformMid)

    const upPoint = await clientPointOnMinimapOverlay(overlay, 0.18, 0.55)
    await overlay.dispatchEvent('pointerup', {
      ...MINIMAP_POINTER_OPTS,
      clientX: upPoint.clientX,
      clientY: upPoint.clientY
    })
  })

  test('Minimap viewport updates when canvas is zoomed', async ({
    comfyPage
  }) => {
    const { container, viewport } = getMinimapLocators(comfyPage)
    await expect(container).toBeVisible()
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
    const { canvas } = getMinimapLocators(comfyPage)
    await expect(canvas).toBeVisible()

    // Minimap should have content before deletion
    await expect.poll(() => hasCanvasContent(canvas)).toBe(true)

    // Remove all nodes
    await comfyPage.canvas.press('Control+a')
    await comfyPage.canvas.press('Delete')
    await comfyPage.nextFrame()

    await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(0)

    // Minimap canvas should be empty — no nodes means nothing to render
    await expect
      .poll(() => hasCanvasContent(canvas), { timeout: 5000 })
      .toBe(false)
  })

  test('Minimap re-renders after loading a different workflow', async ({
    comfyPage
  }) => {
    const { canvas } = getMinimapLocators(comfyPage)
    await expect(canvas).toBeVisible()

    // Default workflow has content
    await expect.poll(() => hasCanvasContent(canvas)).toBe(true)

    // Load a very different workflow
    await comfyPage.workflow.loadWorkflow('large-graph-workflow')
    await comfyPage.nextFrame()

    // Minimap should still have content (different workflow, still has nodes)
    await expect
      .poll(() => hasCanvasContent(canvas), { timeout: 5000 })
      .toBe(true)
  })

  test('Minimap viewport position reflects canvas pan state', async ({
    comfyPage
  }) => {
    const { container, viewport } = getMinimapLocators(comfyPage)
    await expect(container).toBeVisible()
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

test.describe('Minimap mobile', { tag: ['@mobile', '@canvas'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.page.waitForFunction(() => window.app && window.app.canvas)
  })

  test('Minimap is hidden by default on small viewports', async ({
    comfyPage
  }) => {
    const innerWidth = await comfyPage.page.evaluate(() => window.innerWidth)
    expect(
      innerWidth,
      'Mobile project should use a viewport narrower than the lg breakpoint'
    ).toBeLessThan(1024)

    await expect
      .poll(() =>
        comfyPage.settings.getSetting<boolean>('Comfy.Minimap.Visible')
      )
      .toBe(false)

    await expect(
      comfyPage.page.getByTestId(TestIds.canvas.minimapContainer)
    ).toHaveCount(0)

    const toggle = comfyPage.page.getByTestId(
      TestIds.canvas.toggleMinimapButton
    )
    await expect(toggle).toBeVisible()
  })
})
