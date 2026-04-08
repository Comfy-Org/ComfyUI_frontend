import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

async function pressKeyAndExpectRequest(
  comfyPage: ComfyPage,
  key: string,
  urlPattern: string,
  method: string = 'POST'
) {
  const requestPromise = comfyPage.page.waitForRequest(
    (req) => req.url().includes(urlPattern) && req.method() === method,
    { timeout: 5000 }
  )
  await comfyPage.page.keyboard.press(key)
  return requestPromise
}

test.describe('Default Keybindings', { tag: '@keyboard' }, () => {
  test.describe('Sidebar Toggle Shortcuts', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.canvas.click({ position: { x: 400, y: 400 } })
      await comfyPage.nextFrame()
    })

    const sidebarTabs = [
      { key: 'KeyW', tabId: 'workflows', label: 'workflows' },
      { key: 'KeyN', tabId: 'node-library', label: 'node library' },
      { key: 'KeyM', tabId: 'model-library', label: 'model library' },
      { key: 'KeyA', tabId: 'assets', label: 'assets' }
    ] as const

    for (const { key, tabId, label } of sidebarTabs) {
      test(`'${key}' toggles ${label} sidebar`, async ({ comfyPage }) => {
        const selectedButton = comfyPage.page.locator(
          `.${tabId}-tab-button.side-bar-button-selected`
        )

        await expect(selectedButton).not.toBeVisible()

        await comfyPage.canvas.press(key)
        await comfyPage.nextFrame()
        await expect(selectedButton).toBeVisible()

        await comfyPage.canvas.press(key)
        await comfyPage.nextFrame()
        await expect(selectedButton).not.toBeVisible()
      })
    }
  })

  test.describe('Canvas View Controls', () => {
    test("'Alt+=' zooms in", async ({ comfyPage }) => {
      const initialScale = await comfyPage.canvasOps.getScale()

      await comfyPage.canvas.press('Alt+Equal')
      await comfyPage.nextFrame()

      const newScale = await comfyPage.canvasOps.getScale()
      expect(newScale).toBeGreaterThan(initialScale)
    })

    test("'Alt+-' zooms out", async ({ comfyPage }) => {
      const initialScale = await comfyPage.canvasOps.getScale()

      await comfyPage.canvas.press('Alt+Minus')
      await comfyPage.nextFrame()

      const newScale = await comfyPage.canvasOps.getScale()
      expect(newScale).toBeLessThan(initialScale)
    })

    test("'.' fits view to nodes", async ({ comfyPage }) => {
      // Set scale very small so fit-view will zoom back to fit nodes
      await comfyPage.canvasOps.setScale(0.1)
      const scaleBefore = await comfyPage.canvasOps.getScale()
      expect(scaleBefore).toBeCloseTo(0.1, 1)

      // Click canvas to ensure focus is within graph-canvas-container
      await comfyPage.canvas.click({ position: { x: 400, y: 400 } })
      await comfyPage.nextFrame()

      await comfyPage.canvas.press('Period')
      await comfyPage.nextFrame()

      const scaleAfter = await comfyPage.canvasOps.getScale()
      expect(scaleAfter).toBeGreaterThan(scaleBefore)
    })

    test("'h' locks canvas", async ({ comfyPage }) => {
      expect(await comfyPage.canvasOps.isReadOnly()).toBe(false)

      await comfyPage.canvas.press('KeyH')
      await comfyPage.nextFrame()

      expect(await comfyPage.canvasOps.isReadOnly()).toBe(true)
    })

    test("'v' unlocks canvas", async ({ comfyPage }) => {
      // Lock first
      await comfyPage.command.executeCommand('Comfy.Canvas.Lock')
      await comfyPage.nextFrame()
      expect(await comfyPage.canvasOps.isReadOnly()).toBe(true)

      await comfyPage.canvas.press('KeyV')
      await comfyPage.nextFrame()

      expect(await comfyPage.canvasOps.isReadOnly()).toBe(false)
    })
  })

  test.describe('Node State Toggles', () => {
    test("'Alt+c' collapses and expands selected nodes", async ({
      comfyPage
    }) => {
      const nodes = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      expect(nodes.length).toBeGreaterThan(0)
      const node = nodes[0]

      await node.click('title')
      await comfyPage.nextFrame()

      expect(await node.isCollapsed()).toBe(false)

      await comfyPage.canvas.press('Alt+KeyC')
      await comfyPage.nextFrame()
      expect(await node.isCollapsed()).toBe(true)

      await comfyPage.canvas.press('Alt+KeyC')
      await comfyPage.nextFrame()
      expect(await node.isCollapsed()).toBe(false)
    })

    test("'Ctrl+m' mutes and unmutes selected nodes", async ({ comfyPage }) => {
      const nodes = await comfyPage.nodeOps.getNodeRefsByType('CLIPTextEncode')
      expect(nodes.length).toBeGreaterThan(0)
      const node = nodes[0]

      await node.click('title')
      await comfyPage.nextFrame()

      // Normal mode is ALWAYS (0)
      const getMode = () =>
        comfyPage.page.evaluate((nodeId) => {
          return window.app!.canvas.graph!.getNodeById(nodeId)!.mode
        }, node.id)

      expect(await getMode()).toBe(0)

      await comfyPage.canvas.press('Control+KeyM')
      await comfyPage.nextFrame()
      // NEVER (2) = muted
      expect(await getMode()).toBe(2)

      await comfyPage.canvas.press('Control+KeyM')
      await comfyPage.nextFrame()
      expect(await getMode()).toBe(0)
    })
  })

  test.describe('Mode and Panel Toggles', () => {
    test("'Alt+m' toggles app mode", async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

      // Set up linearData so app mode has something to show
      await comfyPage.appMode.enterAppModeWithInputs([])
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()

      // Toggle off with Alt+m
      await comfyPage.page.keyboard.press('Alt+KeyM')
      await comfyPage.nextFrame()
      await expect(comfyPage.appMode.linearWidgets).not.toBeVisible()

      // Toggle on again
      await comfyPage.page.keyboard.press('Alt+KeyM')
      await comfyPage.nextFrame()
      await expect(comfyPage.appMode.linearWidgets).toBeVisible()
    })

    test("'Alt+Shift+m' toggles minimap", async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
      await comfyPage.settings.setSetting('Comfy.Minimap.Visible', true)
      await comfyPage.settings.setSetting('Comfy.Graph.CanvasMenu', true)
      await comfyPage.workflow.loadWorkflow('default')

      const minimap = comfyPage.page.locator('.litegraph-minimap')
      await expect(minimap).toBeVisible()

      await comfyPage.page.keyboard.press('Alt+Shift+KeyM')
      await comfyPage.nextFrame()
      await expect(minimap).not.toBeVisible()

      await comfyPage.page.keyboard.press('Alt+Shift+KeyM')
      await comfyPage.nextFrame()
      await expect(minimap).toBeVisible()
    })

    test("'Ctrl+`' toggles terminal/logs panel", async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')

      await expect(comfyPage.bottomPanel.root).not.toBeVisible()

      await comfyPage.page.keyboard.press('Control+Backquote')
      await comfyPage.nextFrame()
      await expect(comfyPage.bottomPanel.root).toBeVisible()

      await comfyPage.page.keyboard.press('Control+Backquote')
      await comfyPage.nextFrame()
      await expect(comfyPage.bottomPanel.root).not.toBeVisible()
    })
  })

  test.describe('Queue and Execution', () => {
    test("'Ctrl+Enter' queues prompt", async ({ comfyPage }) => {
      const request = await pressKeyAndExpectRequest(
        comfyPage,
        'Control+Enter',
        '/prompt',
        'POST'
      )
      expect(request.url()).toContain('/prompt')
    })

    test("'Ctrl+Shift+Enter' queues prompt to front", async ({ comfyPage }) => {
      const request = await pressKeyAndExpectRequest(
        comfyPage,
        'Control+Shift+Enter',
        '/prompt',
        'POST'
      )
      const body = request.postDataJSON()
      expect(body.front).toBe(true)
    })

    test("'Ctrl+Alt+Enter' interrupts execution", async ({ comfyPage }) => {
      const request = await pressKeyAndExpectRequest(
        comfyPage,
        'Control+Alt+Enter',
        '/interrupt',
        'POST'
      )
      expect(request.url()).toContain('/interrupt')
    })
  })

  test.describe('File Operations', () => {
    test("'Ctrl+s' triggers save workflow", async ({ comfyPage }) => {
      // On a new unsaved workflow, Ctrl+s triggers Save As dialog.
      // The dialog appearing proves the keybinding was intercepted by the app.
      await comfyPage.page.keyboard.press('Control+s')
      await comfyPage.nextFrame()

      // The Save As dialog should appear (p-dialog overlay)
      const dialogOverlay = comfyPage.page.locator('.p-dialog-mask')
      await expect(dialogOverlay).toBeVisible({ timeout: 3000 })

      // Dismiss the dialog
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()
    })

    test("'Ctrl+o' triggers open workflow", async ({ comfyPage }) => {
      // Ctrl+o calls app.ui.loadFile() which clicks a hidden file input.
      // Detect the file input click via an event listener.
      await comfyPage.page.evaluate(() => {
        window.TestCommand = false
        const fileInputs =
          document.querySelectorAll<HTMLInputElement>('input[type="file"]')
        for (const input of fileInputs) {
          input.addEventListener('click', () => {
            window.TestCommand = true
          })
        }
      })

      await comfyPage.page.keyboard.press('Control+o')
      await comfyPage.nextFrame()

      expect(await comfyPage.page.evaluate(() => window.TestCommand)).toBe(true)
    })
  })

  test.describe('Graph Operations', () => {
    test("'Ctrl+Shift+e' converts selection to subgraph", async ({
      comfyPage
    }) => {
      const initialCount = await comfyPage.nodeOps.getGraphNodesCount()
      expect(initialCount).toBeGreaterThan(1)

      // Select all nodes
      await comfyPage.canvas.press('Control+a')
      await comfyPage.nextFrame()

      await comfyPage.page.keyboard.press('Control+Shift+KeyE')
      await comfyPage.nextFrame()

      // After conversion, node count should decrease
      // (multiple nodes replaced by single subgraph node)
      await expect
        .poll(() => comfyPage.nodeOps.getGraphNodesCount(), {
          timeout: 5000
        })
        .toBeLessThan(initialCount)
    })

    test("'r' refreshes node definitions", async ({ comfyPage }) => {
      const request = await pressKeyAndExpectRequest(
        comfyPage,
        'KeyR',
        '/object_info',
        'GET'
      )
      expect(request.url()).toContain('/object_info')
    })
  })
})
