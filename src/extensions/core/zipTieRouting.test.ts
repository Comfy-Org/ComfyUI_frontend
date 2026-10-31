import { assert, describe, expect, it } from 'vitest'

import { createTestNode } from '@/lib/litegraph/src/__fixtures__/nodeHelpers'
import { LGraph, LLink } from '@/lib/litegraph/src/litegraph'
import { toRerouteId } from '@comfyorg/graph-model/rerouteId'

import {
  createZipTie,
  getZipTies,
  releaseZipTie,
  resolveZipTie
} from './zipTieRouting'

function createWiredGraph() {
  const graph = new LGraph()
  const links = ['MODEL', 'CONDITIONING', 'LATENT'].map((type) => {
    const source = createTestNode(graph, [], [type])
    const target = createTestNode(graph, [type])
    const link = source.connect(0, target, 0)
    assert.exists(link)
    return link
  })
  return { graph, links }
}

describe('zip tie routing', () => {
  it('bundles different wire types without changing connections or other wires', () => {
    const { graph, links } = createWiredGraph()
    const connections = links.map((link) => link.serialize())

    const tie = createZipTie(graph, links.slice(0, 2), [320, 150])

    assert.exists(tie)
    expect(links.map((link) => link.serialize())).toEqual(connections)
    expect(
      resolveZipTie(graph, tie).map((reroute) => [...reroute.pos])
    ).toEqual([
      [284, 147],
      [356, 147],
      [284, 153],
      [356, 153]
    ])
    expect(LLink.getReroutes(graph, links[2])).toEqual([])
  })

  it('restores editable ties and independent connections after saving and loading', () => {
    const { graph, links } = createWiredGraph()
    createZipTie(graph, links, [180, 245])
    const saved = graph.serialize()
    const restored = new LGraph()

    restored.configure(saved)

    const [tie] = getZipTies(restored)
    assert.exists(tie)
    expect(
      resolveZipTie(restored, tie).map((reroute) => [...reroute.pos])
    ).toEqual([
      [144, 239],
      [216, 239],
      [144, 245],
      [216, 245],
      [144, 251],
      [216, 251]
    ])
    expect(
      [...restored.links.values()].map((link) => link.serialize())
    ).toEqual(links.map((link) => link.serialize()))
  })

  it('releases only the chosen tie and preserves earlier routing', () => {
    const { graph, links } = createWiredGraph()
    const existing = graph.createReroute([90, 110], links[0])
    assert.exists(existing)
    const tie = createZipTie(graph, links, [180, 150])
    assert.exists(tie)
    const second = createZipTie(graph, links.slice(0, 2), [270, 250])
    assert.exists(second)

    releaseZipTie(graph, tie)

    expect(graph.links.size).toBe(3)
    expect(getZipTies(graph)).toEqual([second])
    expect(graph.reroutes.get(existing.id)).toBe(existing)
    expect(
      LLink.getReroutes(graph, links[0]).map((reroute) => [...reroute.pos])
    ).toEqual([
      [90, 110],
      [234, 247],
      [306, 247]
    ])
  })

  it('keeps a partially disconnected bundle usable and releasable', () => {
    const { graph, links } = createWiredGraph()
    const tie = createZipTie(graph, links.slice(0, 2), [180, 150])
    assert.exists(tie)

    graph.removeLink(links[0].id)

    expect(resolveZipTie(graph, tie)).toHaveLength(2)
    releaseZipTie(graph, tie)
    expect(graph.getLink(links[1].id)).toBe(links[1])
    expect(graph.reroutes.size).toBe(0)
  })

  it('ignores missing reroutes from deleted nodes', () => {
    const { graph, links } = createWiredGraph()
    const tie = createZipTie(graph, links, [180, 150])
    assert.exists(tie)
    graph.removeReroute(toRerouteId(tie.rerouteIds[0]))

    expect(resolveZipTie(graph, tie)).toHaveLength(5)
  })

  it('does not create a tie from duplicate selections of one wire', () => {
    const { graph, links } = createWiredGraph()

    expect(
      createZipTie(graph, [links[0], links[0]], [180, 150])
    ).toBeUndefined()
    expect(graph.reroutes.size).toBe(0)
  })
})
