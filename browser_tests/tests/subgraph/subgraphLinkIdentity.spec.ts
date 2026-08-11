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
          const [link] = subgraph.links.values()
          return {
            definitionId: subgraph.id,
            linkId: link?.id,
            parentId: link?.parentId,
            rerouteIds: [...subgraph.reroutes.keys()]
          }
        })
        .sort((a, b) => a.definitionId.localeCompare(b.definitionId))
    })

    expect(topology).toEqual([
      {
        definitionId: '11111111-1111-4111-8111-111111111111',
        linkId: 1,
        parentId: 101,
        rerouteIds: [101]
      },
      {
        definitionId: '22222222-2222-4222-8222-222222222222',
        linkId: 2,
        parentId: 201,
        rerouteIds: [201]
      }
    ])
  })
})
