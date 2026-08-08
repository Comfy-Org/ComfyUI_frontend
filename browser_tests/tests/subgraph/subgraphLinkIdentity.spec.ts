import { expect } from '@playwright/test'

import { toLinkId } from '@/types/linkId'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Subgraph link topology identity', { tag: ['@subgraph'] }, () => {
  test('different definitions keep their own reroute chains when link IDs and endpoints collide', async ({
    comfyPage
  }) => {
    test.fail()
    await comfyPage.workflow.loadWorkflow(
      'subgraphs/subgraph-link-identity-collision'
    )

    const collidingLinkId = toLinkId(1)
    const topology = await comfyPage.page.evaluate((linkId) => {
      const graph = window.app!.canvas.graph!
      return graph.nodes
        .filter((node) => node.isSubgraphNode())
        .map((node) => ({
          definitionId: node.subgraph.id,
          parentId: node.subgraph._links.get(linkId)?.parentId,
          rerouteIds: [...node.subgraph.reroutes.keys()]
        }))
        .sort((a, b) => a.definitionId.localeCompare(b.definitionId))
    }, collidingLinkId)

    expect(topology).toEqual([
      {
        definitionId: '11111111-1111-4111-8111-111111111111',
        parentId: 101,
        rerouteIds: [101]
      },
      {
        definitionId: '22222222-2222-4222-8222-222222222222',
        parentId: 201,
        rerouteIds: [201]
      }
    ])
  })
})
