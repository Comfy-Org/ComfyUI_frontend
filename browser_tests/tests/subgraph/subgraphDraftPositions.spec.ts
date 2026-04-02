import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe(
  'Subgraph node positions after draft reload',
  { tag: ['@subgraph'] },
  () => {
    test('Node positions are preserved after draft reload with subgraph auto-entry', async ({
      comfyPage
    }) => {
      test.setTimeout(30000)

      // Load a workflow containing a subgraph
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      // Enter the subgraph and record internal node positions
      await comfyPage.vueNodes.enterSubgraph()
      await expect.poll(() => comfyPage.subgraph.isInSubgraph()).toBe(true)

      const positionsBefore = await comfyPage.page.evaluate(() => {
        const sg = [...window.app!.rootGraph.subgraphs.values()][0]
        return sg.nodes.map((n) => ({
          id: n.id,
          x: n.pos[0],
          y: n.pos[1]
        }))
      })

      expect(positionsBefore.length).toBeGreaterThan(0)

      // Reload the page keeping localStorage (draft auto-loads)
      await comfyPage.setup({ clearStorage: false })

      // Wait for subgraph auto-entry via hash navigation
      await expect
        .poll(() => comfyPage.subgraph.isInSubgraph(), { timeout: 10000 })
        .toBe(true)

      // Verify all internal node positions are preserved
      const positionsAfter = await comfyPage.page.evaluate(() => {
        const sg = [...window.app!.rootGraph.subgraphs.values()][0]
        return sg.nodes.map((n) => ({
          id: n.id,
          x: n.pos[0],
          y: n.pos[1]
        }))
      })

      for (const before of positionsBefore) {
        const after = positionsAfter.find((n) => n.id === before.id)
        expect(
          after,
          `Node ${before.id} should exist after reload`
        ).toBeDefined()
        expect(after!.x).toBeCloseTo(before.x, 0)
        expect(after!.y).toBeCloseTo(before.y, 0)
      }
    })
  }
)
