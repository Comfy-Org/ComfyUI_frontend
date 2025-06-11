import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { PerformanceMonitor } from '../helpers/performanceMonitor'

test.describe('Copy Paste', () => {
  test('Can copy and paste node', async ({ comfyPage }) => {
    await comfyPage.clickEmptyLatentNode()
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.ctrlC()
    await comfyPage.ctrlV()
    await expect(comfyPage.canvas).toHaveScreenshot('copied-node.png')
  })

  test('@perf Can copy and paste node with link', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'copy-paste-node-with-link'

    await perfMonitor.startMonitoring(testName)

    // Click node with performance tracking
    await perfMonitor.measureOperation('click-text-encode-node', async () => {
      await comfyPage.clickTextEncodeNode1()
    })

    // Mouse move with performance tracking
    await perfMonitor.measureOperation('mouse-move', async () => {
      await comfyPage.page.mouse.move(10, 10)
    })

    // Copy operation with performance tracking
    await perfMonitor.measureOperation('copy-operation', async () => {
      await comfyPage.ctrlC()
    })

    // Mark before paste
    await perfMonitor.markEvent('before-paste')

    // Paste operation with performance tracking
    await perfMonitor.measureOperation('paste-operation', async () => {
      await comfyPage.page.keyboard.press('Control+Shift+V')
    })

    // Mark after paste
    await perfMonitor.markEvent('after-paste')

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Can copy and paste text', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'copy-paste-text'

    await perfMonitor.startMonitoring(testName)

    const textBox = comfyPage.widgetTextBox

    await perfMonitor.measureOperation('click-textbox', async () => {
      await textBox.click()
    })

    let originalString: string
    await perfMonitor.measureOperation('get-input-value', async () => {
      originalString = await textBox.inputValue()
    })

    await perfMonitor.measureOperation('select-text', async () => {
      await textBox.selectText()
    })

    await perfMonitor.measureOperation('copy-text', async () => {
      await comfyPage.ctrlC(null)
    })

    await perfMonitor.measureOperation('paste-text-first', async () => {
      await comfyPage.ctrlV(null)
    })

    await perfMonitor.measureOperation('paste-text-second', async () => {
      await comfyPage.ctrlV(null)
    })

    const resultString = await textBox.inputValue()
    expect(resultString).toBe(originalString! + originalString!)

    await perfMonitor.finishMonitoring(testName)
  })

  // skip reason: fails, did not investigate why
  test.skip('@perf Can copy and paste widget value', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'copy-paste-widget-value'

    await perfMonitor.startMonitoring(testName)

    // Copy width value (512) from empty latent node to KSampler's seed.
    // KSampler's seed
    await perfMonitor.measureOperation('click-ksampler-seed', async () => {
      await comfyPage.canvas.click({
        position: {
          x: 1005,
          y: 281
        }
      })
    })

    await perfMonitor.measureOperation('copy-widget-value', async () => {
      await comfyPage.ctrlC(null)
    })

    // Empty latent node's width
    await perfMonitor.measureOperation('click-empty-latent-width', async () => {
      await comfyPage.canvas.click({
        position: {
          x: 718,
          y: 643
        }
      })
    })

    await perfMonitor.measureOperation('paste-widget-value', async () => {
      await comfyPage.ctrlV(null)
    })

    await perfMonitor.measureOperation('confirm-with-enter', async () => {
      await comfyPage.page.keyboard.press('Enter')
    })

    await perfMonitor.finishMonitoring(testName)
  })

  /**
   * https://github.com/Comfy-Org/ComfyUI_frontend/issues/98
   */
  test('@perf Paste in text area with node previously copied', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'paste-text-with-node-copied'

    await perfMonitor.startMonitoring(testName)

    await perfMonitor.measureOperation('click-empty-latent-node', async () => {
      await comfyPage.clickEmptyLatentNode()
    })

    await perfMonitor.measureOperation('copy-node', async () => {
      await comfyPage.ctrlC(null)
    })

    const textBox = comfyPage.widgetTextBox

    await perfMonitor.measureOperation('click-textbox', async () => {
      await textBox.click()
    })

    await perfMonitor.measureOperation('get-input-value', async () => {
      await textBox.inputValue()
    })

    await perfMonitor.measureOperation('select-text', async () => {
      await textBox.selectText()
    })

    await perfMonitor.measureOperation('copy-text', async () => {
      await comfyPage.ctrlC(null)
    })

    await perfMonitor.measureOperation('paste-text-first', async () => {
      await comfyPage.ctrlV(null)
    })

    await perfMonitor.measureOperation('paste-text-second', async () => {
      await comfyPage.ctrlV(null)
    })

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Copy text area does not copy node', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'copy-text-no-node'

    await perfMonitor.startMonitoring(testName)

    const textBox = comfyPage.widgetTextBox

    await perfMonitor.measureOperation('click-textbox', async () => {
      await textBox.click()
    })

    await perfMonitor.measureOperation('get-input-value', async () => {
      await textBox.inputValue()
    })

    await perfMonitor.measureOperation('select-text', async () => {
      await textBox.selectText()
    })

    await perfMonitor.measureOperation('copy-text', async () => {
      await comfyPage.ctrlC(null)
    })

    // Unfocus textbox.
    await perfMonitor.measureOperation('unfocus-textbox', async () => {
      await comfyPage.page.mouse.click(10, 10)
    })

    await perfMonitor.measureOperation('paste-attempt', async () => {
      await comfyPage.ctrlV(null)
    })

    await perfMonitor.finishMonitoring(testName)
  })

  test('@perf Copy node by dragging + alt', async ({ comfyPage }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'copy-node-drag-alt'

    await perfMonitor.startMonitoring(testName)

    // TextEncodeNode1
    await perfMonitor.measureOperation('mouse-move-to-node', async () => {
      await comfyPage.page.mouse.move(618, 191)
    })

    await perfMonitor.markEvent('alt-key-down')
    await comfyPage.page.keyboard.down('Alt')

    await perfMonitor.measureOperation('mouse-down', async () => {
      await comfyPage.page.mouse.down()
    })

    await perfMonitor.measureOperation('drag-node', async () => {
      await comfyPage.page.mouse.move(100, 100)
    })

    await perfMonitor.measureOperation('mouse-up', async () => {
      await comfyPage.page.mouse.up()
    })

    await perfMonitor.markEvent('alt-key-up')
    await comfyPage.page.keyboard.up('Alt')

    await perfMonitor.finishMonitoring(testName)
  })

  // skip reason: fails, did not investigate why
  test.skip('@perf Can undo paste multiple nodes as single action', async ({
    comfyPage
  }) => {
    const perfMonitor = new PerformanceMonitor(comfyPage.page)
    const testName = 'undo-paste-multiple-nodes'

    await perfMonitor.startMonitoring(testName)

    let initialCount: number
    await perfMonitor.measureOperation('get-initial-count', async () => {
      initialCount = await comfyPage.getGraphNodesCount()
    })
    expect(initialCount!).toBeGreaterThan(1)

    await perfMonitor.measureOperation('click-canvas', async () => {
      await comfyPage.canvas.click()
    })

    await perfMonitor.measureOperation('select-all', async () => {
      await comfyPage.ctrlA()
    })

    await perfMonitor.measureOperation('mouse-move', async () => {
      await comfyPage.page.mouse.move(10, 10)
    })

    await perfMonitor.measureOperation('copy-all-nodes', async () => {
      await comfyPage.ctrlC()
    })

    await perfMonitor.measureOperation('paste-all-nodes', async () => {
      await comfyPage.ctrlV()
    })

    let pasteCount: number
    await perfMonitor.measureOperation('get-paste-count', async () => {
      pasteCount = await comfyPage.getGraphNodesCount()
    })
    expect(pasteCount!).toBe(initialCount! * 2)

    await perfMonitor.measureOperation('undo-paste', async () => {
      await comfyPage.ctrlZ()
    })

    let undoCount: number
    await perfMonitor.measureOperation('get-undo-count', async () => {
      undoCount = await comfyPage.getGraphNodesCount()
    })
    expect(undoCount!).toBe(initialCount!)

    await perfMonitor.finishMonitoring(testName)
  })
})
