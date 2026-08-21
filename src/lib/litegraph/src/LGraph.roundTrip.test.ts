import { describe, expect, test } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'

import floatingLink from './__fixtures__/assets/floatingLink.json'
import linkedNodes from './__fixtures__/assets/linkedNodes.json'
import reroutesComplex from './__fixtures__/assets/reroutesComplex.json'

/**
 * Loading a workflow and saving it again must not lose entities.
 *
 * The existing round-trip tests compare a second serialisation to the first,
 * which proves the output is a fixed point but says nothing about whether the
 * *input* survived. These assert the property users actually depend on: open a
 * workflow, save it, and everything you had is still there.
 *
 * Serialisation deliberately normalises — schema version is rewritten and
 * conflicting ids are reassigned — so this compares entity sets and counts
 * rather than bytes.
 */

interface RoundTripFixture {
  name: string
  graph: ISerialisedGraph
}

const fixtures: RoundTripFixture[] = [
  { name: 'linked nodes', graph: linkedNodes as unknown as ISerialisedGraph },
  { name: 'floating link', graph: floatingLink as unknown as ISerialisedGraph },
  {
    name: 'complex reroutes',
    graph: reroutesComplex as unknown as ISerialisedGraph
  }
]

function roundTrip(source: ISerialisedGraph) {
  const loaded = new LGraph(structuredClone(source))
  return loaded.serialize()
}

function ascending(a: number | string, b: number | string) {
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

function rerouteIds(graph: { extra?: { reroutes?: { id: number }[] } }) {
  return (graph.extra?.reroutes ?? [])
    .map((reroute) => reroute.id)
    .sort(ascending)
}

describe('LGraph round trip preserves the input', () => {
  for (const { name, graph } of fixtures) {
    describe(name, () => {
      test('keeps every node, by id', () => {
        const before = graph.nodes.map((node) => node.id).sort(ascending)
        const after = roundTrip(graph)
          .nodes.map((node) => node.id)
          .sort(ascending)

        expect(after).toEqual(before)
      })

      test('keeps every link', () => {
        const before = graph.links?.length ?? 0

        expect(roundTrip(graph).links?.length ?? 0).toBe(before)
      })

      test('keeps every reroute, by id', () => {
        expect(rerouteIds(roundTrip(graph))).toEqual(rerouteIds(graph))
      })

      test('keeps every group', () => {
        const before = graph.groups?.length ?? 0

        expect(roundTrip(graph).groups?.length ?? 0).toBe(before)
      })

      test('does not mutate the workflow it was given', () => {
        const untouched = structuredClone(graph)
        const subject = structuredClone(graph)

        new LGraph(subject).serialize()

        expect(subject).toEqual(untouched)
      })

      test('is stable when saved twice', () => {
        const once = roundTrip(graph)
        const twice = new LGraph(structuredClone(once)).serialize()

        expect(twice).toEqual(once)
      })
    })
  }
})
