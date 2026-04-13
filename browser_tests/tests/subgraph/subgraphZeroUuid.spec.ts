import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Zero UUID workflow: subgraph undo rendering',
  { tag: ['@workflow', '@subgraph', '@vue-nodes'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      test.setTimeout(30000) // Extend timeout as we need to reload the page an additional time
      await comfyPage.page.reload() // Reload page to ensure Vue mode is active
      await comfyPage.page.waitForFunction(() => !!window.app?.graph)
    })

    test('Undo after subgraph enter/exit renders all nodes when workflow starts with zero UUID', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow(
        'subgraphs/basic-subgraph-zero-uuid'
      )
      await comfyPage.vueNodes.waitForNodes()

      const assertInSubgraph = async (inSubgraph: boolean) => {
        await expect
          .poll(() => comfyPage.subgraph.isInSubgraph())
          .toBe(inSubgraph)
      }

      // Root graph has 1 subgraph node, rendered in the DOM
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
      await expect.poll(() => comfyPage.vueNodes.getNodeCount()).toBe(1)

      await comfyPage.vueNodes.enterSubgraph()
      await assertInSubgraph(true)

      await comfyPage.subgraph.exitViaBreadcrumb()
      await assertInSubgraph(false)

      await comfyPage.canvas.focus()
      await comfyPage.keyboard.undo()
      await comfyPage.nextFrame()

      // After undo, the subgraph node is still visible and rendered
      await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
      await expect.poll(() => comfyPage.vueNodes.getNodeCount()).toBe(1)
    })
  }
)
