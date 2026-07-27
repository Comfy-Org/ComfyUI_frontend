import { expect } from '@playwright/test'

import type {
  ExportedSubgraph,
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { CURATED_TEMPLATE_IDS } from '@/renderer/extensions/firstRunTour/gettingStarted/tutorialCards'
import { TOUR_ROLE_PINS } from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
import type {
  RolePin,
  RolePins
} from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
import { templateApiFixture as test } from '@e2e/fixtures/templateApiFixture'

const baseUrl = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'

const pinnedTemplates = Object.entries(TOUR_ROLE_PINS)

function pinnedRoles(pins: RolePins): [string, RolePin][] {
  const roles = { source: pins.source, prompt: pins.prompt, sink: pins.sink }
  return Object.entries(roles).filter(
    (entry): entry is [string, RolePin] => entry[1] !== undefined
  )
}

/** Subgraph definitions nest, and so does the resolver's host-mapping. */
function nodesOf(
  graph: SerialisableGraph | ExportedSubgraph
): ISerialisedNode[] {
  return [
    ...(graph.nodes ?? []),
    ...(graph.definitions?.subgraphs ?? []).flatMap(nodesOf)
  ]
}

function findNode(workflow: SerialisableGraph, id: number) {
  return nodesOf(workflow).find((node) => String(node.id) === String(id))
}

test.describe('first-run tour role pins', { tag: '@workflow' }, () => {
  test('every pinned node still exists with its pinned type', async ({
    request
  }) => {
    const unserved: string[] = []

    for (const [templateId, pins] of pinnedTemplates) {
      const url = new URL(`/templates/${templateId}.json`, baseUrl).toString()
      const response = await request.get(url)
      if (!response.ok()) {
        unserved.push(templateId)
        continue
      }

      const workflow = (await response.json()) as SerialisableGraph
      for (const [role, pin] of pinnedRoles(pins)) {
        expect(
          findNode(workflow, pin.id)?.type,
          `${templateId} pins its ${role} to node ${pin.id}, which this backend no longer serves as a ${pin.type}`
        ).toBe(pin.type)
      }
    }

    expect(
      CURATED_TEMPLATE_IDS.filter((id) => unserved.includes(id)),
      'the Getting Started grid ships a card for each of these, so an unserved one 404s the user'
    ).toEqual([])
  })
})
