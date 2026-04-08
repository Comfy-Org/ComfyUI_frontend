import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'
import { DefaultGraphPositions } from '../fixtures/constants/defaultGraphPositions'

test.beforeEach(async ({ comfyPage }) => {
  await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
})

test.describe('Copy Paste', { tag: ['@screenshot', '@workflow'] }, () => {
  test('Can copy and paste node', async ({ comfyPage }) => {
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick
    })
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()
    await expect(comfyPage.canvas).toHaveScreenshot('copied-node.png')
  })

  test('Can copy and paste node with link', async ({ comfyPage }) => {
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.textEncodeNode1
    })
    await comfyPage.nextFrame()
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.clipboard.copy()
    await comfyPage.page.keyboard.press('Control+Shift+V')
    await expect(comfyPage.canvas).toHaveScreenshot('copied-node-with-link.png')
  })

  test('Can copy and paste text', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    const originalString = await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.clipboard.copy(null)
    await comfyPage.clipboard.paste(null)
    await comfyPage.clipboard.paste(null)
    await expect
      .poll(() => textBox.inputValue())
      .toBe(originalString + originalString)
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
    await comfyPage.clipboard.copy(null)
    // Empty latent node's width
    await comfyPage.canvas.click({
      position: {
        x: 718,
        y: 643
      }
    })
    await comfyPage.clipboard.paste(null)
    await comfyPage.page.keyboard.press('Enter')
    await expect(comfyPage.canvas).toHaveScreenshot('copied-widget-value.png')
  })

  /**
   * https://github.com/Comfy-Org/ComfyUI_frontend/issues/98
   */
  test('Paste in text area with node previously copied', async ({
    comfyPage
  }) => {
    await comfyPage.canvas.click({
      position: DefaultGraphPositions.emptyLatentWidgetClick
    })
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.nextFrame()
    await comfyPage.clipboard.copy(null)
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.clipboard.copy(null)
    await comfyPage.clipboard.paste(null)
    await comfyPage.clipboard.paste(null)
    await expect(comfyPage.canvas).toHaveScreenshot(
      'paste-in-text-area-with-node-previously-copied.png'
    )
  })

  test('Copy text area does not copy node', async ({ comfyPage }) => {
    const textBox = comfyPage.widgetTextBox
    await textBox.click()
    await textBox.inputValue()
    await textBox.selectText()
    await comfyPage.clipboard.copy(null)
    // Unfocus textbox.
    await comfyPage.page.mouse.click(10, 10)
    await comfyPage.clipboard.paste(null)
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
    const initialCount = await comfyPage.nodeOps.getGraphNodesCount()
    expect(initialCount).toBeGreaterThan(1)
    await comfyPage.canvas.click()
    await comfyPage.keyboard.selectAll()
    await comfyPage.page.mouse.move(10, 10)
    await comfyPage.clipboard.copy()
    await comfyPage.clipboard.paste()

    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialCount * 2)

    await comfyPage.keyboard.undo()
    await expect
      .poll(() => comfyPage.nodeOps.getGraphNodesCount())
      .toBe(initialCount)
  })

  test(
    'Copy paste node, image paste onto LoadImage, image paste on empty canvas',
    { tag: ['@node'] },
    async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('nodes/load_image_with_ksampler')
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(2)

      // Step 1: Copy a KSampler node with Ctrl+C and paste with Ctrl+V
      const ksamplerNodes =
        await comfyPage.nodeOps.getNodeRefsByType('KSampler')
      await ksamplerNodes[0].copy()
      await comfyPage.canvas.click({ position: { x: 50, y: 500 } })
      await comfyPage.nextFrame()
      await comfyPage.clipboard.paste()
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount(), {
          timeout: 5_000
        })
        .toBe(3)

      // Step 2: Paste image onto selected LoadImage node
      const loadImageNodes =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      await loadImageNodes[0].click('title')
      await comfyPage.nextFrame()

      const uploadPromise = comfyPage.page.waitForResponse(
        (resp) => resp.url().includes('/upload/') && resp.status() === 200,
        { timeout: 10_000 }
      )
      await comfyPage.clipboard.pasteFile(
        comfyPage.assetPath('image32x32.webp')
      )
      await uploadPromise

      await expect
        .poll(
          async () => {
            const fileWidget = await loadImageNodes[0].getWidget(0)
            return fileWidget.getValue()
          },
          { timeout: 5_000 }
        )
        .toContain('image32x32')
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(3)

      // Step 3: Click empty canvas area, paste image → creates new LoadImage
      await comfyPage.canvas.click({ position: { x: 50, y: 500 } })
      await comfyPage.nextFrame()

      const uploadPromise2 = comfyPage.page.waitForResponse(
        (resp) => resp.url().includes('/upload/') && resp.status() === 200,
        { timeout: 10_000 }
      )
      await comfyPage.clipboard.pasteFile(
        comfyPage.assetPath('image32x32.webp')
      )
      await uploadPromise2

      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount(), {
          timeout: 5_000
        })
        .toBe(4)
      const allLoadImageNodes =
        await comfyPage.nodeOps.getNodeRefsByType('LoadImage')
      expect(allLoadImageNodes).toHaveLength(2)
    }
  )
})
