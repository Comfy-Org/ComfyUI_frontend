import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { agentTest as test } from '@e2e/tests/agent/agentPanelMocks'

async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox()
  if (!box) throw new Error('element is not rendered')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function clickThroughInertLayer(page: Page, locator: Locator) {
  const { x, y } = await centerOf(locator)
  await page.mouse.click(x, y)
}

test.describe('Agent node selection mode lockdown', { tag: '@cloud' }, () => {
  test.describe('canvas info overlay', () => {
    test.use({ initialSettings: { 'Comfy.Graph.CanvasInfo': true } })

    test('hides the canvas info overlay while node selection mode is active', async ({
      agentPanel,
      comfyPage
    }) => {
      function showInfo() {
        return comfyPage.page.evaluate(() => window.app!.canvas.show_info)
      }

      await test.step('the overlay starts enabled', async () => {
        await expect.poll(showInfo).toBe(true)
      })

      await test.step('enter node selection mode', async () => {
        await agentPanel.enterNodeSelectionMode()
      })

      await test.step('the overlay is hidden', async () => {
        await expect.poll(showInfo).toBe(false)
      })
    })
  })

  test.describe('floating queue overlay', () => {
    test.use({ initialSettings: { 'Comfy.Queue.QPOV2': false } })

    test('hides the floating queue overlay while node selection mode is active', async ({
      agentPanel,
      comfyPage
    }) => {
      const { overlay } = comfyPage.queuePanel

      await test.step('open the queue overlay', async () => {
        await comfyPage.command.executeCommand('Comfy.Queue.ToggleOverlay')
        await expect(overlay).toBeVisible()
      })

      await test.step('enter node selection mode', async () => {
        await agentPanel.enterNodeSelectionMode()
      })

      await test.step('the overlay is gone', async () => {
        await expect(overlay).toHaveCount(0)
      })

      await test.step('exiting restores the overlay', async () => {
        await agentPanel.exitNodeSelectionMode()
        await expect(overlay).toBeVisible()
      })
    })
  })

  test.describe('floating sidebar', () => {
    test.use({
      initialSettings: {
        'Comfy.Sidebar.Size': 'small',
        'Comfy.Sidebar.Style': 'floating'
      }
    })

    test('collapses the floating sidebar without leaving its gutter', async ({
      agentPanel,
      comfyPage
    }) => {
      const toolbar = comfyPage.menu.sideToolbar

      await test.step('the rail starts inset by its gutter', async () => {
        await expect(toolbar).toContainClass('floating-sidebar')
        await expect(toolbar).not.toHaveCSS('margin-left', '0px')
        await expect(toolbar).toHaveCSS('overflow', 'visible')
      })

      await test.step('enter node selection mode', async () => {
        await agentPanel.enterNodeSelectionMode()
      })

      await test.step('the rail takes no width while hidden', async () => {
        await expect(toolbar).toHaveCSS('margin-left', '0px')
        await expect(toolbar).toHaveCSS('overflow', 'hidden')
        await expect
          .poll(async () => (await toolbar.boundingBox())?.width ?? null)
          .toBe(0)
      })

      await test.step('exiting restores the gutter', async () => {
        await agentPanel.exitNodeSelectionMode()
        await expect(toolbar).not.toHaveCSS('margin-left', '0px')
        await expect(toolbar).toHaveCSS('overflow', 'visible')
      })
    })
  })

  test.describe('with Vue nodes', { tag: '@vue-nodes' }, () => {
    test.use({ objectInfo: 'server' })

    test.afterEach(async ({ agentPanel, comfyPage }) => {
      if (await agentPanel.nodeSelectionBanner.isVisible()) {
        await agentPanel.exitNodeSelectionMode()
      }
      await comfyPage.canvasOps.resetView()
    })

    test('keeps panning and zooming available while picking without dropping the picked node', async ({
      agentPanel,
      comfyPage
    }) => {
      const page = comfyPage.page
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const selectedNodeReference = agentPanel.root.getByRole('button', {
        name: /Remove CLIP Text Encode \(Prompt\) #\d+ reference/
      })

      await test.step('create and select a node while picking', async () => {
        await comfyPage.nodeOps.clearGraph()
        await comfyPage.nodeOps.addNode('CLIPTextEncode', undefined, {
          x: 200,
          y: 200
        })
        await expect(node).toBeVisible()
        await agentPanel.enterNodeSelectionMode()
        await expect(node).toBeInViewport()
        await clickThroughInertLayer(page, node.getByTestId('node-title'))
        await expect(node).toHaveClass(/outline-node-component-outline/)
        await expect(selectedNodeReference).toBeVisible()
      })

      const offsetBefore = await comfyPage.canvasOps.getOffset()
      const scaleBefore = await comfyPage.canvasOps.getScale()
      const nodeBox = await node.boundingBox()
      if (!nodeBox) throw new Error('node is not rendered')
      const emptyCanvasSpot = {
        x: nodeBox.x + nodeBox.width / 2,
        y: nodeBox.y + nodeBox.height + 120
      }

      await test.step('dragging empty canvas pans the viewport', async () => {
        await comfyPage.canvasOps.pan({ x: -120, y: -80 }, emptyCanvasSpot)
        await expect
          .poll(() => comfyPage.canvasOps.getOffset())
          .not.toEqual(offsetBefore)
        await expect(node).toHaveClass(/outline-node-component-outline/)
        await expect(selectedNodeReference).toBeVisible()
      })

      await test.step('the wheel over empty canvas zooms the viewport', async () => {
        await page.mouse.move(emptyCanvasSpot.x, emptyCanvasSpot.y)
        await page.mouse.wheel(0, -240)
        await expect
          .poll(() => comfyPage.canvasOps.getScale())
          .not.toBe(scaleBefore)
        await expect(node).toHaveClass(/outline-node-component-outline/)
        await expect(selectedNodeReference).toBeVisible()
        await expect(agentPanel.nodeSelectionBanner).toBeVisible()
      })
    })

    test('keeps Vue node widgets read-only while picking and still selects the clicked node', async ({
      agentPanel,
      comfyPage
    }) => {
      const page = comfyPage.page
      const node = comfyPage.vueNodes
        .getNodeByTitle('CLIP Text Encode (Prompt)')
        .first()
      const prompt = node.getByRole('textbox')
      function selectOnly() {
        return page.evaluate(() => window.app!.canvas.selectOnly)
      }

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
      })

      await test.step('clicking the prompt widget selects the node', async () => {
        await clickThroughInertLayer(page, prompt)
        await expect(node).toHaveClass(/outline-node-component-outline/)
        await expect(
          agentPanel.root.getByRole('button', {
            name: /Remove CLIP Text Encode \(Prompt\) #\d+ reference/
          })
        ).toBeVisible()
        await expect.poll(selectOnly).toBe(true)
      })

      await test.step('typing does not edit the widget', async () => {
        await page.keyboard.type('x')
        await expect(prompt).toHaveValue('before')
        await expect(prompt).not.toBeFocused()
      })

      await test.step('exiting restores editing', async () => {
        await page.keyboard.press('Escape')
        await expect(agentPanel.nodeSelectionBanner).toHaveCount(0)
        await expect.poll(selectOnly).toBe(false)
        await prompt.click()
        await page.keyboard.type('x')
        await expect(prompt).toHaveValue('beforex')
      })
    })
  })
})
