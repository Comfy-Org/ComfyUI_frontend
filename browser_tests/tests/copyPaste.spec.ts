import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

test.describe('Copy Paste', () => {
  test('Can copy and paste node', async ({ comfyPage }) => {
    await comfyPage.clickEmptyLatentNode()
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.ctrlC()
    await comfyPage.ctrlV()
    await expect(comfyPage.canvas).toHaveScreenshot('copied-node.png')
  })

  test('Can copy and paste node with link', async ({ comfyPage }) => {
    await comfyPage.clickTextEncodeNode1()
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.ctrlC()
    await comfyPage.page.keyboard.press('Control+Shift+V')
    await expect(comfyPage.canvas).toHaveScreenshot('copied-node-with-link.png')
  })

  test('Can copy and paste text', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    const originalString = await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.ctrlC(null)
    await comfyPage.ctrlV(null)
    await comfyPage.ctrlV(null)
    const resultString = await textBox.inputValue()
    expect(resultString).toBe(originalString + originalString)
  })

  test('Can copy and paste widget value', async ({ comfyPage }) => {
    // Copy width value (512) from empty latent node to KSampler's seed.
    // KSampler's seed
    await comfyPage.canvas.click({
      position: {
        x: 1005,
        y: 281
      }
    })
    await comfyPage.ctrlC(null)
    // Empty latent node's width
    await comfyPage.canvas.click({
      position: {
        x: 718,
        y: 643
      }
    })
    await comfyPage.ctrlV(null)
    await comfyPage.page.keyboard.press('Enter')
    await expect(comfyPage.canvas).toHaveScreenshot('copied-widget-value.png')
  })

  /**
   * https://github.com/Comfy-Org/ComfyUI_frontend/issues/98
   */
  test('Paste in text area with node previously copied', async ({
    comfyPage
  }) => {
    await comfyPage.clickEmptyLatentNode()
    await comfyPage.ctrlC(null)
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.ctrlC(null)
    await comfyPage.ctrlV(null)
    await comfyPage.ctrlV(null)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'paste-in-text-area-with-node-previously-copied.png'
    )
  })

  test('Copy text area does not copy node', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.ctrlC(null)
    // Unfocus textbox.
    await comfyPage.page.mouse.click(10, 10)
    await comfyPage.ctrlV(null)
    await expect(comfyPage.canvas).toHaveScreenshot('no-node-copied.png')
  })

  test('Copy node by dragging + alt', async ({ comfyPage }) => {
    // TextEncodeNode1
    await comfyPage.page.mouse.move(618, 191)
    await comfyPage.page.keyboard.down('Alt')
    await comfyPage.page.mouse.down()
    await comfyPage.page.mouse.move(100, 100)
    await comfyPage.page.mouse.up()
    await comfyPage.page.keyboard.up('Alt')
    await expect(comfyPage.canvas).toHaveScreenshot('drag-copy-copied-node.png')
  })

  test('Can undo paste multiple nodes as single action', async ({
    comfyPage
  }) => {
    const initialCount = await comfyPage.getGraphNodesCount()
    expect(initialCount).toBeGreaterThan(1)
    await comfyPage.canvas.click()
    await comfyPage.ctrlA()
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.ctrlC()
    await comfyPage.ctrlV()

    const pasteCount = await comfyPage.getGraphNodesCount()
    expect(pasteCount).toBe(initialCount * 2)

    await comfyPage.ctrlZ()
    const undoCount = await comfyPage.getGraphNodesCount()
    expect(undoCount).toBe(initialCount)
  })
})
