import { nodesMap, OPAQUE_WIDGETS_KEY } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import { showPlaceholdersAsWaiting } from '@/platform/lateCustomNodes/waitingNodes'

import { followedDoc } from './__fixtures__/followedDoc'
import { LiveGraphApplier } from './liveGraphApplier'

vi.mock(import('@/platform/telemetry/reportError'))

describe('LiveGraphApplier on a node waiting for its pack', () => {
  it('keeps a remote edit made to the node while it waits', () => {
    const graph = new LGraph()
    const { doc, collector } = followedDoc(
      {
        nodes: [{ id: 1, type: 'LatePackNode', pos: [0, 0], size: [210, 100] }],
        links: []
      },
      { types: {} }
    )
    const docNode = nodesMap(doc).get('1')
    if (!docNode) throw new Error('no node 1 in the document')
    doc.transact(() => {
      docNode.delete('widgets')
      docNode.set(OPAQUE_WIDGETS_KEY, { prompt: 'original' })
    })
    const applier = new LiveGraphApplier({ getGraph: () => graph })
    const context = { actor: 'agent:test:turn-1', opIds: ['op-1'] }
    applier.applyChanges(doc, collector.take(), context)

    showPlaceholdersAsWaiting(graph)
    doc.transact(() =>
      docNode.set(OPAQUE_WIDGETS_KEY, { prompt: 'updated remotely' })
    )
    applier.applyChanges(doc, collector.take(), context)

    expect(graph.nodes[0].serialize().widgets_values).toEqual({
      prompt: 'updated remotely'
    })
  })
})
