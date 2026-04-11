import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

const UPDATED_SUBGRAPH_TITLE = 'Updated Subgraph Title'

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
  test.describe('Subgraph Navigation and UI', () => {
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

      await subgraphNode.navigateIntoSubgraph()

      const breadcrumb = comfyPage.page.getByTestId(TestIds.breadcrumb.subgraph)
      await expect(breadcrumb).toBeVisible({ timeout: 20_000 })
      const initialBreadcrumbText = (await breadcrumb.textContent()) ?? ''

      await comfyPage.keyboard.press('Escape')

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
      await comfyPage.keyboard.press('Enter')

      await subgraphNode.navigateIntoSubgraph()
      await expect(breadcrumb).toBeVisible()

      await expect(breadcrumb).toContainText(UPDATED_SUBGRAPH_TITLE)
      await expect(breadcrumb).not.toHaveText(initialBreadcrumbText)
    })

    test('Switching workflows while inside subgraph returns to root graph context and hides the breadcrumb', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      const breadcrumb = comfyPage.page.getByTestId(TestIds.breadcrumb.subgraph)
      const backButton = breadcrumb.locator('.back-button')
      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()
      await comfyPage.nextFrame()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)
      await expect(backButton).toBeVisible()

      await comfyPage.workflow.loadWorkflow('default')
      await comfyPage.nextFrame()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
      await expect(backButton).toHaveCount(0)

      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
      await expect(backButton).toHaveCount(0)
    })
  })

  test.describe('Navigation Hotkeys', () => {
    test.beforeEach(async ({ comfyPage }) => {
      await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    })

    test('Navigation hotkey can be customized', async ({ comfyPage }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

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

      await comfyPage.page.reload()
      await comfyPage.setup()
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()
      await expect(
        comfyPage.page.getByTestId(TestIds.breadcrumb.subgraph)
      ).toBeVisible()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.keyboard.press('Escape')
      await expect
        .poll(() => comfyPage.subgraph.isInSubgraph(), {
          message:
            'Escape should stay inside the subgraph after the default binding is unset'
        })
        .toBe(true)

      await comfyPage.keyboard.press('Alt+q')
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
    })

    test('Escape prioritizes closing dialogs over exiting subgraph', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('2')
      await subgraphNode.navigateIntoSubgraph()
      await expect(
        comfyPage.page.getByTestId(TestIds.breadcrumb.subgraph)
      ).toBeVisible()

      await expect
        .poll(() => comfyPage.subgraph.isInSubgraph(), {
          message:
            'Precondition failed: expected to be inside the subgraph before opening settings'
        })
        .toBe(true)

      await comfyPage.page.keyboard.press('Control+,')
      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.settings)
      ).toBeVisible()

      await comfyPage.keyboard.press('Escape')

      await expect(
        comfyPage.page.getByTestId(TestIds.dialogs.settings)
      ).toBeHidden()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.keyboard.press('Escape')
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(false)
    })
  })

  test.describe('Subgraph viewport restoration', () => {
    test('first visit fits viewport to subgraph nodes (LG)', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/subgraph-with-promoted-text-widget'
      )
      await comfyPage.nextFrame()

      const subgraphNode = await comfyPage.nodeOps.getNodeRefById('11')
      await subgraphNode.navigateIntoSubgraph()

      await expect
        .poll(() => comfyPage.page.evaluate(hasVisibleNodeInViewport))
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
        .poll(() => comfyPage.page.evaluate(hasVisibleNodeInViewport))
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
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const ds = window.app!.canvas.ds
            return { scale: ds.scale, offset: [...ds.offset] }
          })
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

  test.describe('Subgraph progress clear on navigation', () => {
    test('Stale progress is cleared on subgraph node after navigating back', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.nextFrame()

      const subgraphNodeId = await comfyPage.subgraph.findSubgraphNodeId()

      await comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.canvas.graph!.getNodeById(nodeId)!
        node.progress = 0.5
      }, subgraphNodeId)

      await expect
        .poll(() =>
          comfyPage.page.evaluate(
            (nodeId) => window.app!.canvas.graph!.getNodeById(nodeId)!.progress,
            subgraphNodeId
          )
        )
        .toBe(0.5)

      const subgraphNode =
        await comfyPage.nodeOps.getNodeRefById(subgraphNodeId)
      await subgraphNode.navigateIntoSubgraph()

      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      await comfyPage.keyboard.press('Escape')

      await expect
        .poll(() =>
          comfyPage.page.evaluate((nodeId) => {
            return window.app!.canvas.graph!.getNodeById(nodeId)!.progress
          }, subgraphNodeId)
        )
        .toBeUndefined()
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

      await expect
        .poll(() =>
          comfyPage.page.evaluate(() => {
            const graph = window.app!.canvas.graph!
            const subgraphNode = graph.nodes.find(
              (node) =>
                typeof node.isSubgraphNode === 'function' &&
                node.isSubgraphNode()
            )
            if (!subgraphNode) return { exists: false, progress: null }

            return { exists: true, progress: subgraphNode.progress }
          })
        )
        .toEqual({ exists: true, progress: undefined })
    })
  })
})
