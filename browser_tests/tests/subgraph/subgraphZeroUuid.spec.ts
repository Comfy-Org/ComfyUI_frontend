import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'
import type { ComfyWorkflowJSON } from '../../../src/platform/workflow/validation/schemas/workflowSchema'

test.describe(
  'Zero UUID workflow: subgraph undo rendering',
  { tag: ['@workflow', '@subgraph'] },
  () => {
    test.beforeEach(async ({ comfyPage }) => {
      test.setTimeout(30000) // Extend timeout as we need to reload the page an additional time
      await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
      await comfyPage.page.reload() // Reload page as we need to enter in Vue mode
      await comfyPage.page.waitForFunction(() => !!window.app?.graph)
      await comfyPage.vueNodes.waitForNodes()
    })

    test('Undo after subgraph enter/exit renders all nodes when workflow starts with zero UUID', async ({
      comfyPage
    }) => {
      await comfyPage.command.executeCommand('Comfy.Canvas.SelectAll')
      await comfyPage.command.executeCommand('Comfy.Graph.ConvertToSubgraph')
      await comfyPage.page.evaluate(async () => {
        const serialized = window.app!.rootGraph.serialize()
        await window.app!.loadGraphData({
          ...serialized,
          id: '00000000-0000-0000-0000-000000000000'
        } as ComfyWorkflowJSON)
      })

      const assertInSubgraph = async (inSubgraph: boolean) => {
        await expect
          .poll(() => comfyPage.subgraph.isInSubgraph())
          .toBe(inSubgraph)
      }

      const assertVueNodeCount = async () => {
        await expect.poll(() => comfyPage.vueNodes.getNodeCount()).toBe(1)
      }

      const assertGraphNodeCount = async () => {
        await expect.poll(() => comfyPage.nodeOps.getGraphNodesCount()).toBe(1)
        await assertVueNodeCount()
      }

      await assertGraphNodeCount()

      // Enter subgraph
      await comfyPage.vueNodes.enterSubgraph()
      await assertInSubgraph(true)

      // Exit subgraph
      await comfyPage.subgraph.exitViaBreadcrumb()
      await assertInSubgraph(false)

      // Undo
      await comfyPage.canvas.focus()
      await comfyPage.keyboard.undo()
      await comfyPage.nextFrame()

      // All graph nodes must have Vue nodes
      await assertGraphNodeCount()
    })
  }
)
