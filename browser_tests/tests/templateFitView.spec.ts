import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../fixtures/ComfyPage'

/**
 * Tests that templates are automatically fitted to view when loaded.
 *
 * This feature ensures templates with saved off-screen viewport positions
 * (extra.ds) are always displayed correctly by calling fitView() immediately
 * when openSource === 'template', rather than relying on the fallback
 * "no nodes in viewport" detection which uses requestAnimationFrame.
 *
 * The test mocks a template with extreme off-screen viewport position
 * [-5000, -5000] and verifies nodes are visible after loading.
 */
test.describe('Template Fit View', { tag: ['@canvas', '@workflow'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    await comfyPage.settings.setSetting(
      'Comfy.Workflow.ShowMissingModelsWarning',
      false
    )
    await comfyPage.settings.setSetting('Comfy.EnableWorkflowViewRestore', true)
  })

  test('should automatically fit view when loading a template with off-screen saved position', async ({
    comfyPage
  }) => {
    // Mock templates index to have our test template
    await comfyPage.page.route(
      '**/templates/index.json',
      async (route, request) => {
        // First try to get the real response
        const response = await route.fetch()
        const templates = await response.json()

        // Add our test template to the first module
        if (templates.length > 0) {
          templates[0].templates.unshift({
            name: 'test-offscreen-viewport',
            title: 'Test Offscreen Viewport',
            mediaType: 'image',
            mediaSubtype: 'webp',
            description: 'Test template with off-screen viewport position'
          })
        }

        await route.fulfill({
          status: 200,
          body: JSON.stringify(templates),
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      }
    )

    // Mock the test template workflow with extreme off-screen viewport position
    // The nodes are at normal positions (0-1000 range) but extra.ds has extreme offset
    await comfyPage.page.route(
      '**/templates/test-offscreen-viewport.json',
      async (route) => {
        const workflowWithOffscreenViewport = {
          last_node_id: 2,
          last_link_id: 0,
          nodes: [
            {
              id: 1,
              type: 'Note',
              pos: [100, 100],
              size: [210, 60],
              flags: {},
              order: 0,
              mode: 0,
              inputs: [],
              outputs: [],
              properties: { text: '' },
              widgets_values: ['Template loaded successfully']
            },
            {
              id: 2,
              type: 'Note',
              pos: [400, 100],
              size: [210, 60],
              flags: {},
              order: 1,
              mode: 0,
              inputs: [],
              outputs: [],
              properties: { text: '' },
              widgets_values: ['Second node']
            }
          ],
          links: [],
          groups: [],
          config: {},
          extra: {
            ds: {
              scale: 1,
              offset: [-5000, -5000]
            }
          },
          version: 0.4
        }

        await route.fulfill({
          status: 200,
          body: JSON.stringify(workflowWithOffscreenViewport),
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store'
          }
        })
      }
    )

    // Mock the thumbnail image
    await comfyPage.page.route(
      '**/templates/test-offscreen-viewport*.webp',
      async (route) => {
        await route.fulfill({
          status: 200,
          path: 'browser_tests/assets/example.webp',
          headers: {
            'Content-Type': 'image/webp',
            'Cache-Control': 'no-store'
          }
        })
      }
    )

    // Clear the workflow first
    await comfyPage.menu.workflowsTab.open()
    await comfyPage.command.executeCommand('Comfy.NewBlankWorkflow')
    await expect(async () => {
      expect(await comfyPage.nodeOps.getGraphNodesCount()).toBe(0)
    }).toPass({ timeout: 250 })

    // Open templates dialog and load our test template
    await comfyPage.command.executeCommand('Comfy.BrowseTemplates')
    await expect(comfyPage.templates.content).toBeVisible()

    // Click on the first category (which should have our test template)
    const firstCategoryButton = comfyPage.page
      .getByRole('button')
      .filter({ hasText: /Getting Started|Image|Video|Audio/i })
      .first()
    await firstCategoryButton.click()

    // Load the test template
    await comfyPage.templates.loadTemplate('test-offscreen-viewport')
    await expect(comfyPage.templates.content).toBeHidden()

    // Wait for rendering to stabilize
    for (let i = 0; i < 5; i++) {
      await comfyPage.nextFrame()
    }

    // Verify we have nodes loaded
    const nodesCount = await comfyPage.nodeOps.getGraphNodesCount()
    expect(nodesCount).toBe(2)

    // Verify the viewport offset is NOT the saved off-screen position
    // Without our fix, the saved offset [-5000, -5000] would be restored initially
    const viewportState = await comfyPage.page.evaluate(() => {
      const canvas = window.app!.canvas
      return {
        offsetX: canvas.ds.offset[0],
        offsetY: canvas.ds.offset[1],
        scale: canvas.ds.scale
      }
    })

    // The offset should NOT be the saved [-5000, -5000] value
    // Our fix calls fitView() which calculates a proper offset to show all nodes
    expect(
      viewportState.offsetX,
      'Viewport X offset should not be the saved off-screen value'
    ).not.toBe(-5000)
    expect(
      viewportState.offsetY,
      'Viewport Y offset should not be the saved off-screen value'
    ).not.toBe(-5000)

    // The critical assertion: verify nodes are visible in viewport
    // Without our fix, the saved offset [-5000, -5000] would be restored
    // and nodes at [100, 100] and [400, 100] would be completely off-screen
    const hasVisibleNodes = await comfyPage.page.evaluate(() => {
      const app = window.app!
      const canvas = app.canvas
      const nodes = app.graph._nodes

      if (!nodes || nodes.length === 0) return false

      canvas.ds.computeVisibleArea(canvas.viewport)
      const visibleArea = canvas.visible_area

      if (!visibleArea.width || !visibleArea.height) return false

      // Check if at least one node overlaps the visible area
      return nodes.some((node: { pos: number[]; size: number[] }) => {
        const nodeLeft = node.pos[0]
        const nodeTop = node.pos[1]
        const nodeRight = nodeLeft + node.size[0]
        const nodeBottom = nodeTop + node.size[1]

        const overlapsHorizontally =
          nodeRight >= visibleArea.x &&
          nodeLeft <= visibleArea.x + visibleArea.width
        const overlapsVertically =
          nodeBottom >= visibleArea.y &&
          nodeTop <= visibleArea.y + visibleArea.height

        return overlapsHorizontally && overlapsVertically
      })
    })

    expect(
      hasVisibleNodes,
      'Nodes should be visible after loading template (fitView should have been called)'
    ).toBe(true)
  })
})
