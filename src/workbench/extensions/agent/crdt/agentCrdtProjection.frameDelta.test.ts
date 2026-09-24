import { nodesMap } from '@comfyorg/comfy-multi-player'
import { describe, expect, it, onTestFinished } from 'vitest'
import * as Y from 'yjs'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

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

function setup() {
  const host = new Y.Doc()
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => null)
  projection.bind(WORKFLOW_ID, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
    host.destroy()
  })
  return { host, follower, projection }
}

describe('AgentCrdtProjection frame node delta', () => {
  it('reports which document nodes a frame added and removed while no graph is bound', () => {
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
})
