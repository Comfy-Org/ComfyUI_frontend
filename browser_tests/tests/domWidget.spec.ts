import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('DOM Widget', () => {
  test('@perf Collapsed multiline textarea is not visible', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'collapsed-multiline-textarea-visibility'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('load-workflow', async () => {
      await comfyPage.loadWorkflow('collapsed_multiline')
    })

    const textareaWidget = comfyPage.page.locator('.comfy-multiline-input')
    await expect(textareaWidget).not.toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })

  test.skip('@perf Multiline textarea correctly collapses', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'multiline-textarea-collapse'

    await perfMonitor.startMonitoring(testName)

    const multilineTextAreas = comfyPage.page.locator('.comfy-multiline-input')
    const firstMultiline = multilineTextAreas.first()
    const lastMultiline = multilineTextAreas.last()

    await expect(firstMultiline).toBeVisible()
    await expect(lastMultiline).toBeVisible()

    let nodes: any[]
    await perfMonitor.measureOperation('get-nodes-by-type', async () => {
      nodes = await comfyPage.getNodeRefsByType('CLIPTextEncode')
    })

    await perfMonitor.markEvent('before-collapse')

    await perfMonitor.measureOperation('collapse-all-nodes', async () => {
      for (const node of nodes!) {
        await node.click('collapse')
      }
    })

    await perfMonitor.markEvent('after-collapse')

    await expect(firstMultiline).not.toBeVisible()
    await expect(lastMultiline).not.toBeVisible()

    await perfMonitor.finishMonitoring(testName)
  })

  // Skip because fails with vue widget nodes (reason not investigated)
  test.skip('@perf Position update when entering focus mode', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'focus-mode-position-update'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('set-menu-setting', async () => {
      await comfyPage.setSetting('Comfy.UseNewMenu', 'Top')
    })

    await perfMonitor.measureOperation('toggle-focus-mode', async () => {
      await comfyPage.executeCommand('Workspace.ToggleFocusMode')
    })

    await perfMonitor.measureOperation('wait-frame-update', async () => {
      await comfyPage.nextFrame()
    })

    await expect(comfyPage.canvas).toHaveScreenshot('focus-mode-on.png')

    await perfMonitor.finishMonitoring(testName)
  })

  // No DOM widget should be created by creation of interim LGraphNode objects.
  test.skip('@perf Copy node with DOM widget by dragging + alt', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'copy-node-alt-drag'

    await perfMonitor.startMonitoring(testName)

    let initialCount: number
    await perfMonitor.measureOperation('get-initial-widget-count', async () => {
      initialCount = await comfyPage.getDOMWidgetCount()
    })

    await perfMonitor.markEvent('before-copy-operation')

    // TextEncodeNode1
    await perfMonitor.measureOperation('position-mouse-on-node', async () => {
      await comfyPage.page.mouse.move(618, 191)
    })

    await perfMonitor.measureOperation('alt-drag-copy', async () => {
      await comfyPage.page.keyboard.down('Alt')
      await comfyPage.page.mouse.down()
      await comfyPage.page.mouse.move(100, 100)
      await comfyPage.page.mouse.up()
      await comfyPage.page.keyboard.up('Alt')
    })

    await perfMonitor.markEvent('after-copy-operation')

    let finalCount: number
    await perfMonitor.measureOperation('get-final-widget-count', async () => {
      finalCount = await comfyPage.getDOMWidgetCount()
    })

    expect(finalCount!).toBe(initialCount! + 1)

    await perfMonitor.finishMonitoring(testName)
  })
})
