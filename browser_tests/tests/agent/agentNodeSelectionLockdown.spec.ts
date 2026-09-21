import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

test.describe('Agent node selection mode lockdown', { tag: '@cloud' }, () => {
  test.describe('canvas info overlay', () => {
    test.use({ initialSettings: { 'Comfy.Graph.CanvasInfo': true } })

    test('hides the canvas info overlay while node selection mode is active', async ({
      agentPanel,
      comfyPage
    }) => {
      const showInfo = () =>
        comfyPage.page.evaluate(() => window.app!.canvas.show_info)

      await test.step('the overlay starts enabled', async () => {
        await comfyPage.nextFrame()
        expect(await showInfo()).toBe(true)
      })

      await test.step('enter node selection mode', async () => {
        await agentPanel.enterNodeSelectionMode()
        await comfyPage.nextFrame()
      })

      await test.step('the overlay is hidden', async () => {
        await comfyPage.page.screenshot({
          path: test
            .info()
            .outputPath('agent-node-selection-canvas-info-overlay.png')
        })
        expect(await showInfo()).toBe(false)
      })
    })
  })

  test.describe('floating queue overlay', () => {
    test.use({ initialSettings: { 'Comfy.Queue.QPOV2': false } })

    test('hides the floating queue overlay while node selection mode is active', async ({
      agentPanel,
      comfyPage
    }) => {
      const overlay = comfyPage.page.getByTestId('queue-progress-overlay')

      await test.step('open the queue overlay', async () => {
        await comfyPage.command.executeCommand('Comfy.Queue.ToggleOverlay')
        await expect(overlay).toBeVisible()
      })

      await test.step('enter node selection mode', async () => {
        await agentPanel.enterNodeSelectionMode()
      })

      await test.step('the overlay is gone', async () => {
        await comfyPage.page.screenshot({
          path: test.info().outputPath('agent-node-selection-queue-overlay.png')
        })
        await expect(overlay).toHaveCount(0)
      })

      await test.step('exiting restores the overlay', async () => {
        await agentPanel.exitNodeSelectionMode()
        await expect(overlay).toBeVisible()
      })
    })
  })

  test.describe('with Vue nodes', { tag: '@vue-nodes' }, () => {
    test.use({ objectInfo: 'server' })

    test('keeps Vue node widgets read-only while picking and still selects the clicked node', async ({
      agentPanel,
      comfyPage
    }) => {
      const page = comfyPage.page
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const prompt = node.getByRole('textbox')

      await test.step('type into the prompt before picking', async () => {
        await comfyPage.nodeOps.clearGraph()
        await comfyPage.nodeOps.addNode('CLIPTextEncode', undefined, {
          x: 200,
          y: 200
        })
        await expect(node).toBeVisible()
        await prompt.click()
        await page.keyboard.type('before')
        await expect(prompt).toHaveValue('before')
      })

      await test.step('enter node selection mode', async () => {
        await agentPanel.enterNodeSelectionMode()
        await expect(node).toBeInViewport()
        await node.getByTestId('node-title').hover()
      })

      await test.step('clicking the prompt widget selects the node', async () => {
        const promptBox = await prompt.boundingBox()
        if (!promptBox) throw new Error('prompt widget is not rendered')
        await page.mouse.click(
          promptBox.x + promptBox.width / 2,
          promptBox.y + promptBox.height / 2
        )
        await expect(node).toHaveClass(/outline-node-component-outline/)
        await expect(
          agentPanel.root.getByRole('button', {
            name: /Remove CLIP Text Encode \(Prompt\) #\d+ reference/
          })
        ).toBeVisible()
        expect(await page.evaluate(() => window.app!.canvas.selectOnly)).toBe(
          true
        )
      })

      await test.step('typing does not edit the widget', async () => {
        await page.keyboard.type('x')
        await expect(prompt).toHaveValue('before')
        await expect(prompt).not.toBeFocused()
      })

      await test.step('exiting restores editing', async () => {
        await page.keyboard.press('Escape')
        await expect(agentPanel.nodeSelectionBanner).toHaveCount(0)
        expect(await page.evaluate(() => window.app!.canvas.selectOnly)).toBe(
          false
        )
        await prompt.click()
        await page.keyboard.type('x')
        await expect(prompt).toHaveValue('beforex')
      })
    })
  })
})
