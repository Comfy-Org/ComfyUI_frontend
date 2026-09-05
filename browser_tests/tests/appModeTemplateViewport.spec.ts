import { expect } from '@playwright/test'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

import { comfyPageFixture as test, comfyExpect } from '@e2e/fixtures/ComfyPage'

/**
 * Regression test for viewport corruption when loading a template in app mode.
 *
 * Root cause: fitView() ran against a 0×0 canvas element hidden by
 * display:none (linearMode=true), producing scale=0 and offset=NaN.
 * The canvas scheduler now defers viewport ops until the canvas is visible.
 */
test.describe('App Mode Template Viewport', { tag: ['@canvas', '@ui'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.appMode.enableLinearMode()
    await comfyPage.appMode.suppressVueNodeSwitchPopup()
  })

  test('loading a template in app mode does not corrupt viewport', async ({
    comfyPage
  }) => {
    // Enter app mode (canvas becomes hidden via v-show / display:none)
    await comfyPage.appMode.toggleAppMode()
    await comfyExpect(comfyPage.canvas).toBeHidden()

    // Load a template while canvas is hidden — this is the scenario
    // that previously caused scale=0 / offset=NaN corruption.
    // Note: loadGraphData(..., null, { openSource: 'template' }) creates a new
    // temporary workflow tab in graph mode (see workflowService.afterLoadNewGraph),
    // which switches the active workflow and re-shows the canvas automatically.
    await comfyPage.page.evaluate(async () => {
      const app = window.app!
      const workflow = app.graph.serialize()

      await app.loadGraphData(workflow as ComfyWorkflowJSON, true, true, null, {
        openSource: 'template'
      })
    })

    // Loading the template switched to a new graph-mode workflow, so the
    // canvas should become visible and queued scheduler ops should flush.
    await comfyExpect(comfyPage.canvas).toBeVisible()

    // Wait a frame for the scheduler to flush
    await comfyPage.nextFrame()

    // Verify the viewport was NOT corrupted
    const viewport = await comfyPage.page.evaluate(() => {
      const ds = window.app!.canvas.ds
      return {
        scale: ds.scale,
        offsetX: ds.offset[0],
        offsetY: ds.offset[1]
      }
    })

    expect(viewport.scale, 'Scale must not be 0').toBeGreaterThan(0)
    expect(Number.isFinite(viewport.offsetX), 'Offset X must not be NaN').toBe(
      true
    )
    expect(Number.isFinite(viewport.offsetY), 'Offset Y must not be NaN').toBe(
      true
    )
  })

  test('nodes are visible after loading template in app mode and returning to graph', async ({
    comfyPage
  }) => {
    // Enter app mode
    await comfyPage.appMode.toggleAppMode()
    await comfyExpect(comfyPage.canvas).toBeHidden()

    // Load template while canvas is hidden — see note in the previous test
    // about the new graph-mode workflow tab that this opens.
    await comfyPage.page.evaluate(async () => {
      const app = window.app!
      const workflow = app.graph.serialize()

      await app.loadGraphData(workflow as ComfyWorkflowJSON, true, true, null, {
        openSource: 'template'
      })
    })

    // The template load switches to a new graph-mode workflow, so the canvas
    // should become visible without requiring a manual app-mode toggle.
    await comfyExpect(comfyPage.canvas).toBeVisible()
    await comfyPage.nextFrame()

    // Verify nodes exist and are within the visible viewport
    await expect
      .poll(
        () =>
          comfyPage.page.evaluate(() => {
            const app = window.app!
            const canvas = app.canvas
            const nodes = app.graph._nodes
            if (nodes.length === 0) return false

            canvas.ds.computeVisibleArea(canvas.viewport)
            const [vx, vy, vw, vh] = canvas.ds.visible_area
            return nodes.some(
              (n: { pos: number[]; size: number[] }) =>
                n.pos[0] + n.size[0] > vx &&
                n.pos[0] < vx + vw &&
                n.pos[1] + n.size[1] > vy &&
                n.pos[1] < vy + vh
            )
          }),
        { message: 'At least one node should be within the visible viewport' }
      )
      .toBe(true)
  })
})
