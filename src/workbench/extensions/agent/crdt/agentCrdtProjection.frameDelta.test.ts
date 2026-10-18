import { nodesMap } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import type { LGraph } from '@/lib/litegraph/src/litegraph'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'
import { LiveGraphApplier } from './liveGraphApplier'

const WORKFLOW_ID = 'wf-a'

function frame(seq: number, source: Y.Doc, since?: Uint8Array) {
  return {
    workflowId: WORKFLOW_ID,
    seq,
    update: Y.encodeStateAsUpdate(source, since),
    actor: 'agent:comfy:host',
    opIds: []
  }
}

function setup(graph: LGraph | null = null) {
  const host = new Y.Doc()
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(WORKFLOW_ID, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  })
  return { host, follower, projection }
}

describe('AgentCrdtProjection frame node delta', () => {
  it('reports each pending document node change once while no graph is bound', () => {
    const { host, follower, projection } = setup()
    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    nodesMap(host).set('4', new Y.Map([['type', 'Note']]))
    const first = frame(1, host)
    follower.applyRemoteUpdate(first.update)

    expect(projection.applyFrame(first)).toEqual({
      applied: false,
      nodes: { added: ['3', '4'], removed: [] }
    })

    const before = Y.encodeStateVector(host)
    nodesMap(host).delete('3')
    const second = frame(2, host, before)
    follower.applyRemoteUpdate(second.update)

    expect(projection.applyFrame(second)).toEqual({
      applied: false,
      nodes: { added: [], removed: ['3'] }
    })
    expect(projection.discardPending(WORKFLOW_ID)).toEqual({
      added: ['4'],
      removed: ['3']
    })
    expect(projection.applyFrame(second)).toEqual({
      applied: false,
      nodes: { added: [], removed: [] }
    })
  })

  it('reports the delta of a discarded echo and leaves nothing for the next frame', () => {
    const { host, follower, projection } = setup()
    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    follower.applyRemoteUpdate(Y.encodeStateAsUpdate(host))

    expect(projection.discardPending(WORKFLOW_ID)).toEqual({
      added: ['3'],
      removed: []
    })
    expect(projection.applyFrame(frame(2, host))).toEqual({
      applied: false,
      nodes: { added: [], removed: [] }
    })
  })

  it('reports an empty, unapplied outcome for a workflow it is not bound to', () => {
    const { host, projection } = setup()

    expect(
      projection.applyFrame({ ...frame(1, host), workflowId: 'wf-other' })
    ).toEqual({ applied: false, nodes: { added: [], removed: [] } })
    expect(projection.discardPending('wf-other')).toEqual({
      added: [],
      removed: []
    })
  })

  it('retains a failed projection until a clean retry applies it', () => {
    const graph = {} as LGraph
    const applyChanges = vi
      .spyOn(LiveGraphApplier.prototype, 'applyChanges')
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 1 })
      .mockReturnValueOnce({ createdNodeIds: [], failureCount: 0 })
    const { host, follower, projection } = setup(graph)
    nodesMap(host).set('3', new Y.Map([['type', 'KSampler']]))
    const update = frame(1, host)
    follower.applyRemoteUpdate(update.update)

    expect(projection.applyFrame(update)).toMatchObject({
      applied: true,
      failureCount: 1
    })
    expect(projection.hasPendingFailure(WORKFLOW_ID)).toBe(true)

    expect(projection.retryFailed(WORKFLOW_ID)).toMatchObject({
      applied: true,
      failureCount: 0
    })
    expect(projection.hasPendingFailure(WORKFLOW_ID)).toBe(false)
    expect(projection.retryFailed(WORKFLOW_ID)).toBeNull()
    expect(applyChanges).toHaveBeenCalledTimes(2)
    expect(applyChanges.mock.calls[1][1]).toBe(applyChanges.mock.calls[0][1])
  })
})
