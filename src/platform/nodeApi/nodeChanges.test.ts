import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { createComfyApi } from './comfyApi'
import { ComfyApiError } from './errors'
import { provideNodeChangeSource, resetNodeChangeSource } from './nodeChanges'
import type { TrackedProperty } from './nodeChanges'

type Emit = (
  nodeId: string,
  property: TrackedProperty,
  from: unknown,
  to: unknown
) => void

/** Stands in for the app-layer bridge. */
function sourceEmitting() {
  let emit: Emit | undefined
  const unsubscribe = vi.fn()
  provideNodeChangeSource((onChange) => {
    emit = onChange
    return unsubscribe
  })
  return {
    emit: (...args: Parameters<Emit>) => emit?.(...args),
    unsubscribe
  }
}

function apiWithNode() {
  setActivePinia(createTestingPinia({ stubActions: false }))
  const graph = new LGraph()
  const node = new LGraphNode('Sampler')
  graph.add(node)
  return { graph, node, comfy: createComfyApi(() => graph) }
}

describe('onNodeChanged', () => {
  afterEach(resetNodeChangeSource)

  it('reports a change on a node the pack does not own', () => {
    // rgthree's relay exists to watch other nodes' modes; it polls every 500ms
    // and traps `mode` with defineProperty because nothing reports it.
    const source = sourceEmitting()
    const { node, comfy } = apiWithNode()
    const seen: unknown[] = []
    comfy.onNodeChanged((e) => seen.push(e))

    source.emit(String(node.id), 'mode', 0, 2)

    expect(seen).toEqual([
      {
        node: expect.objectContaining({ id: String(node.id) }),
        property: 'mode',
        from: 0,
        to: 2
      }
    ])
  })

  it('drops a change for a node that has since gone', () => {
    const source = sourceEmitting()
    const { comfy } = apiWithNode()
    const listener = vi.fn()
    comfy.onNodeChanged(listener)

    source.emit('999', 'mode', 0, 2)

    expect(listener).not.toHaveBeenCalled()
  })

  it('stops when unsubscribed', () => {
    const source = sourceEmitting()
    const { comfy } = apiWithNode()

    comfy.onNodeChanged(vi.fn())()

    expect(source.unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('fails loudly when the host wired no source', () => {
    // A capability that accepts listeners and never calls them is how
    // onPreview shipped broken for weeks.
    resetNodeChangeSource()
    const { comfy } = apiWithNode()

    expect(() => comfy.onNodeChanged(vi.fn())).toThrow(ComfyApiError)
  })
})
