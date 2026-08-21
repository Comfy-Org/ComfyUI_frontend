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
 * conflicting ids are reassigned — so this compares entity sets rather than
 * bytes. It compares them whole: a count survives an entity being renumbered,
 * repointed at a different slot, or replaced outright.
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

/**
 * Links and groups are compared whole, not counted. A count survives a link
 * being renumbered, repointed at a different slot, or replaced outright.
 */
function linkKeys(graph: Pick<ISerialisedGraph, 'links'>) {
  return (graph.links ?? []).map((link) => JSON.stringify(link)).sort()
}

function floatingLinkKeys(graph: Pick<ISerialisedGraph, 'floatingLinks'>) {
  return (graph.floatingLinks ?? []).map((link) => JSON.stringify(link)).sort()
}

function groupKeys(graph: Pick<ISerialisedGraph, 'groups'>) {
  return (graph.groups ?? [])
    .map(({ id, title, bounding }) => JSON.stringify({ id, title, bounding }))
    .sort()
}

/**
 * Every fixture ships with `groups: []`, so a group assertion against them
 * unmodified compares nothing to nothing.
 */
function withGroups(graph: ISerialisedGraph): ISerialisedGraph {
  return {
    ...structuredClone(graph),
    groups: [
      { id: 1, title: 'first', bounding: [0, 0, 140, 90] },
      { id: 2, title: 'second', bounding: [200, 40, 180, 120] }
    ]
  }
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

      test('keeps every link, with its endpoints', () => {
        expect(linkKeys(roundTrip(graph))).toEqual(linkKeys(graph))
      })

      test('keeps every floating link, with its endpoints', () => {
        expect(floatingLinkKeys(roundTrip(graph))).toEqual(
          floatingLinkKeys(graph)
        )
      })

      test('keeps every reroute, by id', () => {
        expect(rerouteIds(roundTrip(graph))).toEqual(rerouteIds(graph))
      })

      test('keeps every group, by identity and bounds', () => {
        const grouped = withGroups(graph)

        expect(groupKeys(roundTrip(grouped))).toEqual(groupKeys(grouped))
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
