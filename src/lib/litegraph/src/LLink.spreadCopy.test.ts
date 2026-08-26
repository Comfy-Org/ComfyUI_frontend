// oxlint-disable no-misused-spread -- spreading an LLink is what these tests reproduce
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { LLink } from '@/lib/litegraph/src/litegraph'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { RerouteId } from '@/types/rerouteId'
import { toRerouteId } from '@/types/rerouteId'

function connectedPair(parentId?: RerouteId) {
  const graph = new LGraph()
  const source = new LGraphNode('Source')
  source.addOutput('out', 'INT')
  graph.add(source)

  const target = new LGraphNode('Target')
  target.addInput('in', 'INT')
  graph.add(target)

  const link = source.connect(0, target, 0, parentId)!
  return { graph, source, target, link }
}

function insertionScenario(consumerCount: number) {
  const graph = new LGraph()
  const source = new LGraphNode('Checkpoint')
  source.addOutput('model', 'MODEL')
  source.addOutput('clip', 'CLIP')
  graph.add(source)

  const consumers = Array.from({ length: consumerCount }, (_, index) => {
    const consumer = new LGraphNode(`Encode ${index}`)
    consumer.addInput('clip', 'CLIP')
    graph.add(consumer)
    source.connect(1, consumer, 0)
    return consumer
  })

  const inserted = new LGraphNode('CLIPSetLastLayer')
  inserted.addInput('clip', 'CLIP')
  inserted.addOutput('CLIP', 'CLIP')
  graph.add(inserted)

  return { graph, source, consumers, inserted }
}

describe('plain-object copies of LLink (uncovered)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('carries topology onto a spread copy of a link', () => {
    const { graph, link } = connectedPair(toRerouteId(7))
    const copy: Partial<LLink> = { ...graph.links[link.id] }

    expect(copy.id).toBe(link.id)
    expect(copy.type).toBe(link.type)
    expect(copy.origin_id).toBe(link.origin_id)
    expect(copy.origin_slot).toBe(link.origin_slot)
    expect(copy.target_id).toBe(link.target_id)
    expect(copy.target_slot).toBe(link.target_slot)
    expect(copy.parentId).toBe(link.parentId)
  })

  it('rewires Custom-Scripts consumers from copied links (#15594)', () => {
    const { graph, source, consumers, inserted } = insertionScenario(2)
    const saved: Partial<LLink>[] = source.outputs[1].links!.map((id) => ({
      ...graph.links[id]
    }))

    source.disconnectOutput(1)
    source.connect(1, inserted, 0)
    for (const { target_id, target_slot } of saved) {
      const consumer =
        target_id === undefined ? undefined : graph.getNodeById(target_id)
      if (consumer && target_slot !== undefined) {
        inserted.connect(0, consumer, target_slot)
      }
    }

    expect(inserted.getOutputNodes(0)?.map((node) => node.id) ?? []).toEqual(
      consumers.map((consumer) => consumer.id)
    )
    expect(consumers.every((consumer) => consumer.isInputConnected(0))).toBe(
      true
    )
  })
})
