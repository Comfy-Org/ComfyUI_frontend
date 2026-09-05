import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

import type { TargetFrame } from '@/core/graph/document/detachedTargetSession'
import type {
  GraphMutations,
  SemanticLinkPayload,
  SemanticNodePayload
} from '@/core/graph/graphMutations'
import { createTargetFrameApplyPort } from '@/workbench/extensions/agent/crdt/targetFrameProjection'

type RecordedCall =
  | { kind: 'clearSemanticGraph' }
  | { kind: 'reconcileNode'; id: unknown; type: unknown }
  | { kind: 'connect'; id: unknown }

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
    batch(context, define) {
      contexts.push(context)
      const batch = {
        addNode: fail,
        reconcileNode: (payload: SemanticNodePayload) =>
          calls.push({
            kind: 'reconcileNode',
            id: payload.id,
            type: payload.type
          }),
        setWidget: fail,
        connect: (link: SemanticLinkPayload) =>
          calls.push({ kind: 'connect', id: link.id }),
        removeMissing: fail,
        removeLinks: fail,
        deleteNode: fail,
        clearSemanticGraph: () => calls.push({ kind: 'clearSemanticGraph' })
      }
      define(batch)
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
  it('projects the staged snapshot as one clear-then-rebuild batch', () => {
    const doc = new Y.Doc()
    setNode(doc, '2', { type: 'Sink' })
    setNode(doc, '1', { type: 'Source' })
    setLink(doc, '9', [9, '1', 0, '2', 0, 'INT'])
    const { mutations, calls, contexts } = recordingMutations()

    const applied = createTargetFrameApplyPort(mutations).apply(frame, doc)

    expect(applied).toBe(true)
    expect(calls).toEqual([
      { kind: 'clearSemanticGraph' },
      { kind: 'reconcileNode', id: '1', type: 'Source' },
      { kind: 'reconcileNode', id: '2', type: 'Sink' },
      { kind: 'connect', id: 9 }
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

  it('propagates a failed batch commit', () => {
    const doc = new Y.Doc()
    setNode(doc, '1', { type: 'Source' })
    const { mutations } = recordingMutations(false)

    expect(createTargetFrameApplyPort(mutations).apply(frame, doc)).toBe(false)
  })

  it('uses replay stamps and only clears for an empty document', () => {
    const doc = new Y.Doc()
    const { mutations, calls, contexts } = recordingMutations()

    expect(
      createTargetFrameApplyPort(mutations).apply(
        {
          workflowId: 'wf-projection',
          seq: 1,
          update: new Uint8Array()
        },
        doc
      )
    ).toBe(true)
    expect(calls).toEqual([{ kind: 'clearSemanticGraph' }])
    expect(contexts).toEqual([
      { source: 'agent-remote', actor: 'agent-replay', opId: 'replay' }
    ])
  })
})
