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

      // Enable workflow persistence explicitly
      await comfyPage.settings.setSetting('Comfy.Workflow.Persist', true)

      // Load a workflow containing a subgraph
      await comfyPage.workflow.loadWorkflow('subgraphs/basic-subgraph')

      // Enter the subgraph programmatically (fixture node is too small for UI click)
      await comfyPage.page.evaluate(() => {
        const sg = [...window.app!.rootGraph.subgraphs.values()][0]
        if (sg) window.app!.canvas.setGraph(sg)
      })
      await comfyPage.nextFrame()
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

      // Wait for the debounced draft persistence to flush to localStorage
      await comfyPage.workflow.waitForDraftPersisted()

      // Reload the page (draft auto-loads with hash preserved)
      await comfyPage.page.reload({ waitUntil: 'networkidle' })
      await comfyPage.page.waitForFunction(
        () => window.app && window.app.extensionManager
      )
      await comfyPage.page.waitForSelector('.p-blockui-mask', {
        state: 'hidden'
      })
      await comfyPage.nextFrame()

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
