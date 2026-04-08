import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

// Constants
const UPDATED_SUBGRAPH_TITLE = 'Updated Subgraph Title'

// Common selectors
const SELECTORS = {
  breadcrumb: '.subgraph-breadcrumb',
  nodeSearchContainer: '.node-search-container'
} as const

function hasVisibleNodeInViewport() {
  const canvas = window.app!.canvas
  if (!canvas?.graph?._nodes?.length) return false

  const ds = canvas.ds
  const cw = canvas.canvas.width / window.devicePixelRatio
  const ch = canvas.canvas.height / window.devicePixelRatio
  const visLeft = -ds.offset[0]
  const visTop = -ds.offset[1]
  const visRight = visLeft + cw / ds.scale
  const visBottom = visTop + ch / ds.scale

  for (const node of canvas.graph._nodes) {
    const [nx, ny] = node.pos
    const [nw, nh] = node.size
    if (
      nx + nw > visLeft &&
      nx < visRight &&
      ny + nh > visTop &&
      ny < visBottom
    )
      return true
  }
  return false
}

test.describe('Subgraph Navigation', { tag: ['@slow', '@subgraph'] }, () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Disabled')
    await comfyPage.settings.setSetting(
      'Comfy.NodeSearchBoxImpl',
      'v1 (legacy)'
    )
  })

  test.describe('Breadcrumb and Workflow Context', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Breadcrumb updates when subgraph node title is changed', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/nested-subgraph')
      await comfyPage.nextFrame()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('10')
      const nodePos = await subgraphNode.getPosition()
      const nodeSize = await subgraphNode.getSize()

      // Navigate into subgraph
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.page.waitForSelector(SELECTORS.breadcrumb, {
        state: 'visible',
        timeout: 20000
      })

      const breadcrumb = comfyPage.page.locator(SELECTORS.breadcrumb)
      const initialBreadcrumbText = await breadcrumb.textContent()

      // Go back and edit title
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      await comfyPage.canvas.dblclick({
        position: {
          x: nodePos.x + nodeSize.width / 2,
          y: nodePos.y - 10
        },
        delay: 5
      })

      await expect(comfyPage.page.locator('.node-title-editor')).toBeVisible()

      await comfyPage.page.keyboard.press('Control+a')
      await comfyPage.page.keyboard.type(UPDATED_SUBGRAPH_TITLE)
      await comfyPage.page.keyboard.press('Enter')
      await comfyPage.nextFrame()

      // Navigate back into subgraph
      await subgraphNode.navigateIntoSubgraph()

      await comfyPage.page.waitForSelector(SELECTORS.breadcrumb)

      const updatedBreadcrumbText = await breadcrumb.textContent()
      expect(updatedBreadcrumbText).toContain(UPDATED_SUBGRAPH_TITLE)
      expect(updatedBreadcrumbText).not.toBe(initialBreadcrumbText)
    })

    test('Switching workflows while inside subgraph returns to root graph context', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()
      await comfyPage.nextFrame()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
      await expect(comfyPage.page.locator(SELECTORS.breadcrumb)).toBeVisible()

      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)

      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
    })

    test('Breadcrumb disappears after switching workflows while inside subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      const breadcrumb = comfyPage.page
        .getByTestId(TestIds.breadcrumb.subgraph)
        .locator('.p-breadcrumb')

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()
      await comfyPage.nextFrame()

      await expect(breadcrumb).toBeVisible()

      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()

      await expect(breadcrumb).toBeHidden()
    })
  })

  test.describe('Navigation Hotkeys', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Navigation hotkey can be customized', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      // Change the Exit Subgraph keybinding from Escape to Alt+Q
      await comfyPage.settings.setSetting('Comfy.Keybinding.NewBindings', [
        {
          commandId: 'Comfy.Graph.ExitSubgraph',
          combo: {
            key: 'q',
            ctrl: false,
            alt: true,
            shift: false
          }
        }
      ])

      await comfyPage.settings.setSetting('Comfy.Keybinding.UnsetBindings', [
        {
          commandId: 'Comfy.Graph.ExitSubgraph',
          combo: {
            key: 'Escape',
            ctrl: false,
            alt: false,
            shift: false
          }
        }
      ])

      // Reload the page
      await comfyPage.page.reload()
      await comfyPage.setup()
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      // Navigate into subgraph
      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()
      await comfyPage.page.waitForSelector(SELECTORS.breadcrumb)

      // Verify we're in a subgraph
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      // Test that Escape no longer exits subgraph
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()
      if (!(await comfyPage.subgraph.isInSubgraph())) {
        throw new Error('Not in subgraph')
      }

      // Test that Alt+Q now exits subgraph
      await comfyPage.page.keyboard.press('Alt+q')
      await comfyPage.nextFrame()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
    })

    test('Escape prioritizes closing dialogs over exiting subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()
      await comfyPage.page.waitForSelector(SELECTORS.breadcrumb)

      // Verify we're in a subgraph
      if (!(await comfyPage.subgraph.isInSubgraph())) {
        throw new Error('Not in subgraph')
      }

      // Open settings dialog using hotkey
      await comfyPage.page.keyboard.press('Control+,')
      await comfyPage.page.waitForSelector('[data-testid="settings-dialog"]', {
        state: 'visible'
      })

      // Press Escape - should close dialog, not exit subgraph
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      // Dialog should be closed
      await expect(
        comfyPage.page.locator('[data-testid="settings-dialog"]')
      ).not.toBeVisible()

      // Should still be in subgraph
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      // Press Escape again - now should exit subgraph
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
    })
  })

  test.describe('Viewport', () => {
    test('first visit fits viewport to subgraph nodes (LG)', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.nextFrame()

      await comfyPage.page.evaluate(() => {
        const canvas = window.app!.canvas
        const graph = canvas.graph!
        const sgNode = graph._nodes.find((n) =>
          'isSubgraphNode' in n
            ? (
                n as unknown as { isSubgraphNode: () => boolean }
              ).isSubgraphNode()
            : false
        ) as unknown as { subgraph?: typeof graph } | undefined
        if (!sgNode?.subgraph) throw new Error('No subgraph node')

        canvas.setGraph(sgNode.subgraph)
      })

      await expect
        .poll(() => comfyPage.page.evaluate(hasVisibleNodeInViewport), {
          timeout: 2000
        })
        .toBe(true)
    })

    test('first visit fits viewport to subgraph nodes (Vue)', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.vueNodes.waitForNodes()

      await comfyPage.vueNodes.enterSubgraph('11')

      await expect
        .poll(() => comfyPage.page.evaluate(hasVisibleNodeInViewport), {
          timeout: 2000
        })
        .toBe(true)
    })

    test('viewport is restored when returning to root (Vue)', async ({
      comfyPage
    }) => {
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.vueNodes.waitForNodes()

      const rootViewport = await comfyPage.page.evaluate(() => {
        const ds = window.app!.canvas.ds
        return { scale: ds.scale, offset: [...ds.offset] }
      })

      await comfyPage.vueNodes.enterSubgraph('11')
      await comfyPage.nextFrame()

      await comfyPage.subgraph.exitViaBreadcrumb()

      await expect
        .poll(
          () =>
            comfyPage.page.evaluate(() => {
              const ds = window.app!.canvas.ds
              return { scale: ds.scale, offset: [...ds.offset] }
            }),
          { timeout: 2000 }
        )
        .toEqual({
          scale: expect.closeTo(rootViewport.scale, 2),
          offset: [
            expect.closeTo(rootViewport.offset[0], 0),
            expect.closeTo(rootViewport.offset[1], 0)
          ]
        })
    })
  })

  test.describe('Progress State', () => {
    test('Stale progress is cleared on subgraph node after navigating back', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      // Find the subgraph node
      const subgraphNodeId = await comfyPage.subgraph.findSubgraphNodeId()

      // Simulate a stale progress value on the subgraph node.
      // This happens when:
      //   1. User views root graph during execution
      //   2. Progress watcher sets node.progress = 0.5
      //   3. User enters subgraph
      //   4. Execution completes (nodeProgressStates becomes {})
      //   5. Watcher fires, clears subgraph-internal nodes, but root-level
      //      SubgraphNode isn't visible so it keeps stale progress
      //   6. User navigates back — watcher should fire and clear it
      await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.canvas.graph!.getNodeById(nodeId)!
        node.progress = 0.5
      }, subgraphNodeId)

      // Verify progress is set
      const progressBefore = await comfyPage.page.evaluate((nodeId) => {
        return window.app!.canvas.graph!.getNodeById(nodeId)!.progress
      }, subgraphNodeId)
      expect(progressBefore).toBe(0.5)

      // Navigate into the subgraph
      const subgraphNode =
        await comfyPage.nodeOps.getNodeRefById(subgraphNodeId)
      await subgraphNode.navigateIntoSubgraph()

      // Verify we're inside the subgraph
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      // Navigate back to the root graph
      await comfyPage.page.keyboard.press('Escape')
      await comfyPage.nextFrame()

      // The progress watcher should fire when graph changes (because
      // nodeLocationProgressStates is empty {} and the watcher should
      // iterate canvas.graph.nodes to clear stale node.progress values).
      //
      // BUG: Without watching canvasStore.currentGraph, the watcher doesn't
      // fire on subgraph->root navigation when progress is already empty,
      // leaving stale node.progress = 0.5 on the SubgraphNode.
      await expect(async () => {
        const progressAfter = await comfyPage.page.evaluate((nodeId) => {
          return window.app!.canvas.graph!.getNodeById(nodeId)!.progress
        }, subgraphNodeId!)
        expect(progressAfter).toBeUndefined()
      }).toPass({ timeout: 2_000 })
    })

    test('Stale progress is cleared when switching workflows while inside subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      const subgraphNodeId = await comfyPage.subgraph.findSubgraphNodeId()

      await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.canvas.graph!.getNodeById(nodeId)!
        node.progress = 0.7
      }, subgraphNodeId)

      const subgraphNode =
        await comfyPage.nodeOps.getNodeRefById(subgraphNodeId)
      await subgraphNode.navigateIntoSubgraph()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()

      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      await expect(async () => {
        const subgraphProgressState = await comfyPage.page.evaluate(() => {
          const graph = window.app!.canvas.graph!
          const subgraphNode = graph.nodes.find(
            (n) => typeof n.isSubgraphNode === 'function' && n.isSubgraphNode()
          )
          if (!subgraphNode) {
            return { exists: false, progress: null }
          }

          return { exists: true, progress: subgraphNode.progress }
        })
        expect(subgraphProgressState.exists).toBe(true)
        expect(subgraphProgressState.progress).toBeUndefined()
      }).toPass({ timeout: 5_000 })
    })
  })
})
