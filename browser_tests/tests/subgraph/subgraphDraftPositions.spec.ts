import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

function getSubgraphNodePositions() {
  const sg = [...window.app!.rootGraph.subgraphs.values()][0]
  return sg.nodes.map((n) => ({
    id: n.id,
    x: n.pos[0],
    y: n.pos[1]
  }))
}

test.describe(
  'Subgraph node positions after draft reload',
  { tag: ['@subgraph', '@vue-nodes'] },
  () => {
    test('Node positions are preserved after draft reload with subgraph auto-entry', async ({
      comfyPage
    }) => {
      test.setTimeout(30000)

      await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')
      await comfyPage.vueNodes.enterSubgraph()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      let positionsBefore: ReturnType<typeof getSubgraphNodePositions> = []
      await expect
        .poll(async () => {
          positionsBefore = await comfyPage.page.evaluate(
            getSubgraphNodePositions
          )
          return positionsBefore.length
        })
        .toBeGreaterThan(0)

      await comfyPage.workflow.waitForDraftPersisted()
      await comfyPage.workflow.reloadAndWaitForApp()

      await expect
        .poll(() => comfyPage.subgraph.isInSubgraph(), { timeout: 10000 })
        .toBe(true)

      for (const before of positionsBefore) {
        await expect
          .poll(async () => {
            const positionsNow = await comfyPage.page.evaluate(
              getSubgraphNodePositions
            )
            const after = positionsNow.find((n) => n.id === before.id)
            if (!after) return null
            return { x: after.x, y: after.y }
          })
          .toMatchObject({
            x: expect.closeTo(before.x, 0),
            y: expect.closeTo(before.y, 0)
          })
      }
    })
  }
)
