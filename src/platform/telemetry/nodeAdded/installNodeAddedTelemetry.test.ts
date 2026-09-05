import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { ChangeTracker } from '@/scripts/changeTracker'

import { installNodeAddedTelemetry } from './installNodeAddedTelemetry'
import { withNodeAddSource } from './nodeAddSource'

const trackNodeAdded = vi.fn()

vi.mock('..', () => ({
  useTelemetry: () => ({ trackNodeAdded })
}))

function fakeGraph(): LGraph {
  return {
    onNodeAdded: undefined,
    events: new CustomEventTarget<LGraphEventMap>()
  } as unknown as LGraph
}

function addNode(graph: LGraph, type: string) {
  graph.events.dispatch('node:added', {
    node: { type } as unknown as LGraphNode
  })
}

describe('installNodeAddedTelemetry', () => {
  beforeEach(() => {
    ChangeTracker.isLoadingGraph = false
  })

  afterEach(() => {
    ChangeTracker.isLoadingGraph = false
  })

  it('fires trackNodeAdded with the current source on add', () => {
    const graph = fakeGraph()
    installNodeAddedTelemetry(graph)

    withNodeAddSource('sidebar_drag', () => {
      addNode(graph, 'KSampler')
    })

    expect(trackNodeAdded).toHaveBeenCalledExactlyOnceWith({
      node_type: 'KSampler',
      source: 'sidebar_drag'
    })
  })

  it('defaults source to "unknown" outside withNodeAddSource', () => {
    const graph = fakeGraph()
    installNodeAddedTelemetry(graph)

    addNode(graph, 'CheckpointLoader')

    expect(trackNodeAdded).toHaveBeenCalledWith({
      node_type: 'CheckpointLoader',
      source: 'unknown'
    })
  })

  it('skips telemetry during workflow load', () => {
    const graph = fakeGraph()
    installNodeAddedTelemetry(graph)
    ChangeTracker.isLoadingGraph = true

    addNode(graph, 'VAEDecode')

    expect(trackNodeAdded).not.toHaveBeenCalled()
  })

  it('leaves the onNodeAdded callback slot untouched', () => {
    const graph = fakeGraph()
    const previous = vi.fn()
    graph.onNodeAdded = previous

    installNodeAddedTelemetry(graph)

    expect(graph.onNodeAdded).toBe(previous)
    addNode(graph, 'LoadImage')
    expect(trackNodeAdded).toHaveBeenCalledOnce()
  })
})
