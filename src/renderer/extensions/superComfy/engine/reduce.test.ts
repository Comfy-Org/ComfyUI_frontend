import { describe, expect, it } from 'vitest'

import type { SuperGraphDocument } from './documentSchema'
import { docWith, fileItem, generateNode, ioNode, port } from './engineFixtures'
import { findNode } from './graphTopology'
import { initialRuntime, reduceSuperComfy } from './reduce'
import { activityOf } from './selectors'
import type { SuperComfyEvent, SuperComfyState } from './types'

function stateOf(doc: SuperGraphDocument): SuperComfyState {
  return { doc, runtime: initialRuntime() }
}

function replay(
  state: SuperComfyState,
  events: SuperComfyEvent[]
): SuperComfyState {
  return events.reduce(reduceSuperComfy, state)
}

describe(reduceSuperComfy, () => {
  it('[R4a] uploading several files makes one batch on the I/O node', () => {
    const state = stateOf(docWith([ioNode('images', 'image', [fileItem('a')])]))

    const next = reduceSuperComfy(state, {
      type: 'itemsAdded',
      nodeId: 'images',
      items: [fileItem('b'), fileItem('c')],
      mode: 'append'
    })

    expect(findNode(next.doc, 'images')).toMatchObject({
      items: [fileItem('a'), fileItem('b'), fileItem('c')]
    })
  })

  it('[R7c] downstream receives only the successful outputs, in run order', () => {
    const regenerated = {
      ...generateNode('gen', 'image'),
      runs: {
        k0: {
          key: 'k0',
          index: 0,
          outputs: { out: [fileItem('old-0')] },
          finishedAt: 1
        },
        k1: {
          key: 'k1',
          index: 1,
          outputs: { out: [fileItem('old-1')] },
          finishedAt: 1
        },
        k2: {
          key: 'k2',
          index: 2,
          outputs: { out: [fileItem('old-2')] },
          finishedAt: 1
        }
      }
    }
    const sessionId = 'session-1'

    const next = replay(stateOf(docWith([regenerated])), [
      {
        type: 'sessionStarted',
        session: {
          id: sessionId,
          scope: 'node',
          nodeIds: ['gen'],
          startedAt: 2
        }
      },
      {
        type: 'nodeStarted',
        sessionId,
        nodeId: 'gen',
        planKeys: ['k0', 'k1', 'k2'],
        cachedIndices: []
      },
      {
        type: 'runSucceeded',
        sessionId,
        nodeId: 'gen',
        record: {
          key: 'k2',
          index: 2,
          outputs: { out: [fileItem('new-2')] },
          finishedAt: 3
        }
      },
      {
        type: 'runFailed',
        sessionId,
        nodeId: 'gen',
        index: 1,
        key: 'k1',
        message: 'Content policy'
      },
      {
        type: 'runSucceeded',
        sessionId,
        nodeId: 'gen',
        record: {
          key: 'k0',
          index: 0,
          outputs: { out: [fileItem('new-0')] },
          finishedAt: 4
        }
      },
      { type: 'nodeCommitted', sessionId, nodeId: 'gen', at: 5 }
    ])

    expect(findNode(next.doc, 'gen')).toMatchObject({
      result: {
        status: 'partial',
        outputs: { out: [fileItem('new-0'), fileItem('new-2')] },
        failures: [{ key: 'k1', index: 1, message: 'Content policy' }]
      }
    })
  })

  it("[O5] Stop returns running nodes to idle at once, and a stopped run's late result never becomes the node result", () => {
    const running = replay(stateOf(docWith([generateNode('gen', 'image')])), [
      {
        type: 'sessionStarted',
        session: {
          id: 'stopped',
          scope: 'graph',
          nodeIds: ['gen'],
          startedAt: 1
        }
      },
      {
        type: 'nodeStarted',
        sessionId: 'stopped',
        nodeId: 'gen',
        planKeys: ['k0'],
        cachedIndices: []
      },
      { type: 'runStarted', sessionId: 'stopped', nodeId: 'gen', index: 0 },
      { type: 'sessionStopped', sessionId: 'stopped' }
    ])

    expect(activityOf(running, 'gen')).toEqual({ phase: 'idle' })

    const later = replay(running, [
      {
        type: 'sessionStarted',
        session: { id: 'next', scope: 'graph', nodeIds: ['gen'], startedAt: 2 }
      },
      {
        type: 'nodeStarted',
        sessionId: 'next',
        nodeId: 'gen',
        planKeys: ['k0'],
        cachedIndices: []
      },
      {
        type: 'runSucceeded',
        sessionId: 'stopped',
        nodeId: 'gen',
        record: {
          key: 'k0',
          index: 0,
          outputs: { out: [fileItem('late')] },
          finishedAt: 3
        }
      },
      { type: 'nodeCommitted', sessionId: 'stopped', nodeId: 'gen', at: 4 }
    ])

    expect(findNode(later.doc, 'gen')).toMatchObject({ result: null })
  })

  it('[C3] a second wire into a single-item input replaces the first', () => {
    const state = stateOf(
      docWith([
        ioNode('first', 'image'),
        ioNode('second', 'image'),
        generateNode('gen', 'image', { inputs: [port('image', 'image')] })
      ])
    )

    const next = replay(state, [
      {
        type: 'edgeConnected',
        id: 'wire-1',
        from: { node: 'first', port: 'out' },
        to: { node: 'gen', port: 'image' }
      },
      {
        type: 'edgeConnected',
        id: 'wire-2',
        from: { node: 'second', port: 'out' },
        to: { node: 'gen', port: 'image' }
      }
    ])

    expect(next.doc.edges).toEqual([
      {
        id: 'wire-2',
        seq: 1,
        from: { node: 'second', port: 'out' },
        to: { node: 'gen', port: 'image' }
      }
    ])
  })
})
