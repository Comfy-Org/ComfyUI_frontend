import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type { TargetFrame } from '@/core/graph/document/detachedTargetSession'
import type { GraphMutations } from '@/core/graph/graphMutations'
import { createTargetFrameApplyPort } from '@/workbench/extensions/agent/crdt/targetFrameProjection'

type RecordedCall = {
  kind: 'reconcileSnapshot'
  nodeIds: unknown[]
  linkIds: unknown[]
}

function recordingMutations(batchResult = true): {
  mutations: GraphMutations
  calls: RecordedCall[]
  contexts: unknown[]
} {
  const calls: RecordedCall[] = []
  const contexts: unknown[] = []
  const fail = () => {
    throw new Error('projection must only use batch()')
  }
  const mutations: GraphMutations = {
    batch: fail,
    reconcileSnapshot(nodes, links, context) {
      contexts.push(context)
      calls.push({
        kind: 'reconcileSnapshot',
        nodeIds: nodes.map(({ id }) => id),
        linkIds: links.map(({ id }) => id)
      })
      return batchResult
    },
    addNode: fail,
    setWidget: fail,
    connect: fail,
    deleteNode: fail,
    clearSemanticGraph: fail
  }
  return { mutations, calls, contexts }
}

function setNode(doc: Y.Doc, id: string, fields: Record<string, unknown>) {
  const nodes = doc.getMap<Y.Map<unknown>>('nodes')
  const node = new Y.Map<unknown>()
  nodes.set(id, node)
  for (const [key, value] of Object.entries(fields)) node.set(key, value)
}

function setLink(doc: Y.Doc, id: string, tuple: unknown[]) {
  doc.getMap('links').set(id, tuple)
}

const frame: TargetFrame = {
  workflowId: 'wf-projection',
  seq: 1,
  update: new Uint8Array(),
  actor: 'agent-a',
  opIds: ['op-1', 'op-2']
}

describe('createTargetFrameApplyPort', () => {
  it('projects the staged document through snapshot reconciliation', () => {
    const doc = new Y.Doc()
    setNode(doc, '2', { type: 'Sink' })
    setNode(doc, '1', { type: 'Source' })
    setLink(doc, '9', [9, '1', 0, '2', 0, 'INT'])
    const { mutations, calls, contexts } = recordingMutations()

    const applied = createTargetFrameApplyPort(mutations).apply(frame, doc)

    expect(applied).toBe(true)
    expect(calls).toEqual([
      { kind: 'reconcileSnapshot', nodeIds: ['1', '2'], linkIds: [9] }
    ])
    expect(contexts).toEqual([
      {
        source: 'agent-remote',
        actor: 'agent-a',
        opId: 'op-2',
        opIds: ['op-1', 'op-2']
      }
    ])
  })

  it('uses replay defaults when frame stamps are absent', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', { type: 'Source' })
    const { mutations, contexts } = recordingMutations()

    const applied = createTargetFrameApplyPort(mutations).apply(
      { workflowId: frame.workflowId, seq: frame.seq, update: frame.update },
      doc
    )

    expect(applied).toBe(true)
    expect(contexts).toEqual([
      { source: 'agent-remote', actor: 'agent-replay', opId: 'replay' }
    ])
  })

  it('propagates a rejected mutation batch', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', { type: 'Source' })
    const { mutations } = recordingMutations(false)

    expect(createTargetFrameApplyPort(mutations).apply(frame, doc)).toBe(false)
  })

  it('rejects the frame without mutating when a node is malformed', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', { type: 'Source' })
    setNode(doc, '2', { title: 'missing type' })
    const { mutations, calls } = recordingMutations()

    const applied = createTargetFrameApplyPort(mutations).apply(frame, doc)

    expect(applied).toBe(false)
    expect(calls).toEqual([])
  })

  it('rejects the frame without mutating when a link is malformed', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', { type: 'Source' })
    setLink(doc, '9', [9, '1', 0])
    const { mutations, calls } = recordingMutations()

    const applied = createTargetFrameApplyPort(mutations).apply(frame, doc)

    expect(applied).toBe(false)
    expect(calls).toEqual([])
  })
})
