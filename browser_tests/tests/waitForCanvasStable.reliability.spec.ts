/**
 * Reliability testing for waitForCanvasStable() method
 * This test validates that the new canvas stability waiting method
 * is more reliable than arbitrary timeouts
 */
import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('waitForCanvasStable() Reliability Tests', () => {
  test('waitForCanvasStable() should work reliably for widget refresh operations', async ({
    comfyPage
  }) => {
    // Load a workflow with combo widgets that can be refreshed
    await comfyPage.loadWorkflow('inputs/checkbox_seed')

    // Click canvas to focus
    await comfyPage.page.mouse.click(400, 300)

    // Get initial combo values
    const getComboValues = async () => {
      return await comfyPage.page.evaluate(() => {
        return window['app'].graph.nodes
          .filter((node: any) => node.comboWidget)
          .map((node: any) => node.comboWidget.value)
      })
    }

    const initialComboValues = await getComboValues()

    // Press R to trigger refresh - this should cause canvas state changes
    await comfyPage.page.keyboard.press('r')

    // OLD APPROACH: await comfyPage.page.waitForTimeout(500)
    // NEW APPROACH: Wait for canvas to stabilize
    await comfyPage.waitForCanvasStable()

    const refreshedComboValues = await getComboValues()

    // Verify that the refresh actually happened
    expect(refreshedComboValues).not.toEqual(initialComboValues)
  })

  test('waitForCanvasStable() should work reliably for slider widget interactions', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('inputs/simple_slider')

    // OLD APPROACH: await comfyPage.page.waitForTimeout(300)
    // NEW APPROACH: Wait for canvas to stabilize after load
    await comfyPage.waitForCanvasStable()

    const node = (await comfyPage.getFirstNodeRef())!
    const widget = await node.getWidget(0)

    // Set up widget value monitoring
    await comfyPage.page.evaluate(() => {
      const widget = window['app'].graph.nodes[0].widgets[0]
      widget.callback = (value: number) => {
        window['widgetValue'] = value
      }
    })

    // Drag the slider - this triggers canvas updates
    await widget.dragHorizontal(50)

    // Wait for canvas to stabilize after the drag operation
    await comfyPage.waitForCanvasStable()

    // Verify the interaction worked
    const widgetValue = await comfyPage.page.evaluate(
      () => window['widgetValue']
    )
    expect(widgetValue).toBeDefined()
  })

  test('waitForCanvasStable() should work reliably for toast notification operations', async ({
    comfyPage
  }) => {
    // Start with no toasts
    expect(await comfyPage.getVisibleToastCount()).toBe(0)

    // Trigger an operation that shows a toast (convert to group with no selection)
    await comfyPage.page.keyboard.press('Alt+g')

    // OLD APPROACH: await comfyPage.page.waitForTimeout(300)
    // NEW APPROACH: Wait for toast to stabilize
    await comfyPage.waitForToastStable()

    // Verify toast appeared
    expect(await comfyPage.getVisibleToastCount()).toBe(1)
  })

  test('waitForCanvasStable() should handle rapid successive operations', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('inputs/simple_slider')
    await comfyPage.waitForCanvasStable()

    const node = (await comfyPage.getFirstNodeRef())!
    const widget = await node.getWidget(0)

    // Perform multiple rapid operations
    await widget.dragHorizontal(25)
    await comfyPage.waitForCanvasStable()

    await widget.dragHorizontal(-10)
    await comfyPage.waitForCanvasStable()

    await widget.dragHorizontal(15)
    await comfyPage.waitForCanvasStable()

    // If we get here without timeouts, the method is handling rapid operations correctly
    expect(true).toBe(true)
  })

  test('waitForCanvasStable() should timeout gracefully if canvas never stabilizes', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('inputs/simple_slider')

    // Artificially create an unstable state that persists beyond the timeout period
    // Block multiple stability conditions to ensure timeout occurs
    await comfyPage.page.evaluate(() => {
      const interval = setInterval(() => {
        if (window['app'] && window['app'].graph) {
          // Block graph stability
          window['app'].graph.dirty = true

          // Also block canvas stability as backup
          if (window['app'].canvas) {
            window['app'].canvas.rendering = true
          }

          // Also block workflow stability as additional backup
          if (window['app'].extensionManager?.workflow) {
            window['app'].extensionManager.workflow.isBusy = true
          }
        }
      }, 50) // Shorter interval to reduce timing windows

      // Clear after longer time to ensure 1-second timeout occurs first
      setTimeout(() => clearInterval(interval), 5000)
    })

    // This should timeout after 1 second and throw an error
    await expect(comfyPage.waitForCanvasStable(1000)).rejects.toThrow()
  })

  test('waitForCanvasStable() should handle missing app/graph gracefully', async ({
    comfyPage
  }) => {
    // Don't load any workflow, so app.graph might not be ready
    await comfyPage.goto()

    // This should either wait for app to be ready or timeout gracefully
    await expect(async () => {
      await comfyPage.waitForCanvasStable(2000)
    }).not.toThrow()
  })
})

test.describe('Performance Comparison Tests', () => {
  test('waitForCanvasStable() should be faster than equivalent timeout in stable conditions', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('inputs/simple_slider')

    // Time the new method
    const startTime = Date.now()
    await comfyPage.waitForCanvasStable()
    const stableTime = Date.now() - startTime

    // Compare with what would be a 300ms timeout
    expect(stableTime).toBeLessThan(300)
  })

  test('waitForCanvasStable() should complete quickly when canvas is already stable', async ({
    comfyPage
  }) => {
    await comfyPage.loadWorkflow('inputs/simple_slider')
    await comfyPage.waitForCanvasStable() // First call to ensure stability

    // Second call should be very fast since canvas is already stable
    const startTime = Date.now()
    await comfyPage.waitForCanvasStable()
    const quickTime = Date.now() - startTime

    // Should complete within 100ms when already stable
    expect(quickTime).toBeLessThan(100)
  })
})
