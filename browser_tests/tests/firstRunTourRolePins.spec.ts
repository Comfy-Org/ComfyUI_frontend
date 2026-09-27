import { expect } from '@playwright/test'

import type {
  ExportedSubgraph,
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import {
  MEDIA_KIND_BY_SINK_TYPE,
  TOUR_ROLE_PINS
} from '@/renderer/extensions/firstRunTour/roles/tourRolePins'
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

/** Ids are graph-local, so a nested same-id node would satisfy a match-first lookup. */
function matchingNodes(workflow: SerialisableGraph, id: number) {
  return nodesOf(workflow).filter((node) => String(node.id) === String(id))
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
        const matches = matchingNodes(workflow, pin.id)
        expect(
          matches,
          `${templateId} pins its ${role} to node ${pin.id}, which this backend serves ${matches.length} times — a nested same-id node would resolve arbitrarily`
        ).toHaveLength(1)
        expect(
          matches[0]?.type,
          `${templateId} pins its ${role} to node ${pin.id}, which this backend no longer serves as a ${pin.type}`
        ).toBe(pin.type)
      }

      expect(
        MEDIA_KIND_BY_SINK_TYPE[pins.sink.type],
        `${templateId} pins a ${pins.sink.type} sink but claims mediaKind '${pins.mediaKind}', so the result step would preview the wrong medium`
      ).toBe(pins.mediaKind)
    }
    // On failure fix the pin, do not widen this.
    expect(
      unserved,
      'every pinned template must be served, or its card vanishes from the Getting Started grid and its pins go unchecked'
    ).toEqual([])
  })
})
