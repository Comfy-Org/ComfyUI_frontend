import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { ChangeTracker } from '@/scripts/changeTracker'
import { useTelemetry } from '..'

import { installNodeAddedTelemetry } from './installNodeAddedTelemetry'
import { withNodeAddSource } from './nodeAddSource'

vi.mock(import('..'))

function fakeGraph(): LGraph {
  return new LGraph()
}

function addNode(graph: LGraph, type: string) {
  graph.events.dispatch('node:added', {
    node: new LGraphNode(type, type)
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

    expect(useTelemetry()?.trackNodeAdded).toHaveBeenCalledExactlyOnceWith({
      node_type: 'KSampler',
      source: 'sidebar_drag'
    })
  })

  it('defaults source to "unknown" outside withNodeAddSource', () => {
    const graph = fakeGraph()
    installNodeAddedTelemetry(graph)

    addNode(graph, 'CheckpointLoader')

    expect(useTelemetry()?.trackNodeAdded).toHaveBeenCalledWith({
      node_type: 'CheckpointLoader',
      source: 'unknown'
    })
  })

  it('skips telemetry during workflow load', () => {
    const graph = fakeGraph()
    installNodeAddedTelemetry(graph)
    ChangeTracker.isLoadingGraph = true

    addNode(graph, 'VAEDecode')

    expect(useTelemetry()?.trackNodeAdded).not.toHaveBeenCalled()
  })

  it('leaves the onNodeAdded callback slot untouched', () => {
    const graph = fakeGraph()
    const previous = vi.fn()
    graph.onNodeAdded = previous

    installNodeAddedTelemetry(graph)

    expect(graph.onNodeAdded).toBe(previous)
    addNode(graph, 'LoadImage')
    expect(useTelemetry()?.trackNodeAdded).toHaveBeenCalledOnce()
  })
})
