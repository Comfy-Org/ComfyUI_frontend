import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe(
  'Zero UUID workflow: subgraph undo rendering',
  { tag: ['@workflow', '@subgraph', '@vue-nodes'] },
  () => {
    test('Undo after subgraph enter/exit renders all nodes when workflow starts with zero UUID', async ({
      comfyPage
    }) => {
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph', {
        workflow: { id: '00000000-0000-0000-0000-000000000000' }
      })

      const assertInSubgraph = async (inSubgraph: boolean) => {
        await expect
          .poll(() => comfyPage.subgraph.isInSubgraph())
          .toBe(inSubgraph)
      }

      await comfyPage.expectNodeCount(1)
      await expect.poll(() => comfyPage.vueNodes.getNodeCount()).toBe(1)

      await comfyPage.vueNodes.enterSubgraph()
      await assertInSubgraph(true)

      await comfyPage.subgraph.exitViaBreadcrumb()
      await assertInSubgraph(false)

      await comfyPage.canvas.focus()
      await comfyPage.keyboard.undo()
      await comfyPage.nextFrame()

      await comfyPage.expectNodeCount(1)
      await expect.poll(() => comfyPage.vueNodes.getNodeCount()).toBe(1)
    })
  }
)
