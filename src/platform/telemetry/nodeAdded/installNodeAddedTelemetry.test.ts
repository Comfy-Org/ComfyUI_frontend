import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { ChangeTracker } from '@/scripts/changeTracker'

import { installNodeAddedTelemetry } from './installNodeAddedTelemetry'
import { withNodeAddSource } from './nodeAddSource'

const trackNodeAdded = vi.fn()

vi.mock('..', () => ({
  useTelemetry: () => ({ trackNodeAdded })
}))

function fakeGraph(): LGraph {
  return { onNodeAdded: undefined } as unknown as LGraph
}

function fakeNode(type: string): LGraphNode {
  return { type } as unknown as LGraphNode
}

describe('installNodeAddedTelemetry', () => {
  beforeEach(() => {
    trackNodeAdded.mockClear()
    ChangeTracker.isLoadingGraph = false
  })

  afterEach(() => {
    ChangeTracker.isLoadingGraph = false
  })

  it('fires trackNodeAdded with the current source on add', () => {
    const graph = fakeGraph()
    installNodeAddedTelemetry(graph)

    withNodeAddSource('sidebar_drag', () => {
      graph.onNodeAdded?.(fakeNode('KSampler'))
    })

    expect(trackNodeAdded).toHaveBeenCalledExactlyOnceWith({
      node_type: 'KSampler',
      source: 'sidebar_drag'
    })
  })

  it('defaults source to "unknown" outside withNodeAddSource', () => {
    const graph = fakeGraph()
    installNodeAddedTelemetry(graph)

    graph.onNodeAdded?.(fakeNode('CheckpointLoader'))

    expect(trackNodeAdded).toHaveBeenCalledWith({
      node_type: 'CheckpointLoader',
      source: 'unknown'
    })
  })

  it('skips telemetry during workflow load', () => {
    const graph = fakeGraph()
    installNodeAddedTelemetry(graph)
    ChangeTracker.isLoadingGraph = true

    graph.onNodeAdded?.(fakeNode('VAEDecode'))

    expect(trackNodeAdded).not.toHaveBeenCalled()
  })

  it('preserves an existing onNodeAdded subscriber', () => {
    const graph = fakeGraph()
    const previous = vi.fn()
    graph.onNodeAdded = previous
    installNodeAddedTelemetry(graph)

    const node = fakeNode('LoadImage')
    graph.onNodeAdded?.(node)

    expect(previous).toHaveBeenCalledExactlyOnceWith(node)
    expect(trackNodeAdded).toHaveBeenCalledOnce()
  })
})
