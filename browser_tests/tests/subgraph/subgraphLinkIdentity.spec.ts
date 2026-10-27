import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Subgraph link topology identity', { tag: ['@subgraph'] }, () => {
  test('normalizes link IDs across definitions and preserves reroute chains', async ({
    comfyPage
  }) => {
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-link-identity-collision'
    )

    const topology = await comfyPage.page.evaluate(() => {
      const graph = window.app!.canvas.graph!
      return [...graph.subgraphs.values()]
        .map((subgraph) => {
          const link = subgraph.links.values().next().value
          return {
            definitionId: subgraph.id,
            linkId: link?.id,
            parentId: link?.parentId,
            rerouteIds: [...subgraph.reroutes.keys()]
          }
        })
        .sort((a, b) => a.definitionId.localeCompare(b.definitionId))
    })

    expect(topology).toHaveLength(2)
    expect(new Set(topology.map(({ linkId }) => linkId)).size).toBe(2)
    for (const { linkId, parentId, rerouteIds } of topology) {
      expect(linkId).toBeDefined()
      expect(parentId).toBeDefined()
      expect(rerouteIds).toContain(parentId)
    }
  })
})
