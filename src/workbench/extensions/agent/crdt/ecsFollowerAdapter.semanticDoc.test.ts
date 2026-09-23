/**
 * CRDT-STORES-0036: the follower lands host frames in the per-root semantic
 * document. These tests pin the direction of that path (host to semantic
 * document only, KA-6), the root the frame lands in, and the recovery from a
 * frame the adapter dropped while the workflow was unbound.
 */
import { mint, nodesMap } from '@comfyorg/comfy-multi-player'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { isRemoteUpdateOrigin, semanticDocs } from '@/stores/semanticDoc'
import { toRootGraphId } from '@/types/graphScopeId'

import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import type { GraphMutations } from './graphMutations'

function recordingMutations(
  rootGraphId?: GraphMutations['rootGraphId']
): GraphMutations {
  return {
    ...(rootGraphId && { rootGraphId }),
    batch: vi.fn(() => true),
    addNode: vi.fn(() => true),
    setWidget: vi.fn(() => true),
    connect: vi.fn(() => true),
    deleteNode: vi.fn(() => true),
    clearSemanticGraph: vi.fn(() => true)
  }
}

function mintHost(): Y.Doc {
  return mint(
    {
      nodes: [
        {
          id: 1,
          type: 'Source',
          inputs: [],
          outputs: [{ name: 'out', type: 'IMAGE', links: [9] }]
        },
        {
          id: 2,
          type: 'Sink',
          inputs: [{ name: 'image', type: 'IMAGE', link: 9 }],
          outputs: []
        }
      ],
      links: [[9, 1, 0, 2, 0, 'IMAGE']]
    },
    { types: {} }
  )
}

function frameFrom(host: Y.Doc, follower: FollowerDoc): Uint8Array {
  return Y.encodeStateAsUpdate(host, follower.stateVector())
}

describe('EcsFollowerAdapter semantic document merge', () => {
  afterEach(() => {
    semanticDocs.destroyAll()
  })

  it('merges under agent-remote provenance and never writes back (KA-6)', () => {
    const host = mintHost()
    const hostUpdates: unknown[] = []
    host.on('update', (_update: Uint8Array, origin: unknown) => {
      hostUpdates.push(origin)
    })
    const follower = new FollowerDoc()
    const followerOrigins: unknown[] = []
    follower.doc.on('update', (_update: Uint8Array, origin: unknown) => {
      followerOrigins.push(origin)
    })
    const adapter = new EcsFollowerAdapter(recordingMutations())
    adapter.bind('wf', follower)

    const root = toRootGraphId('wf')
    const semanticOrigins: unknown[] = []
    semanticDocs
      .ensure(root)
      .on('update', (_update: Uint8Array, origin: unknown) => {
        semanticOrigins.push(origin)
      })

    const update = frameFrom(host, follower)
    follower.applyRemoteUpdate(update)
    const followerOriginsBeforeFrame = followerOrigins.length
    expect(
      adapter.applyFrame({ workflowId: 'wf', seq: 1, update, actor: 'agent-7' })
    ).toBe(true)

    expect(semanticOrigins).toHaveLength(1)
    expect(isRemoteUpdateOrigin(semanticOrigins[0])).toBe(true)
    expect(semanticOrigins[0]).toEqual({
      source: 'agent-remote',
      actor: 'agent-7'
    })
    // The host doc and the follower doc saw nothing from the semantic merge.
    expect(hostUpdates).toEqual([])
    expect(followerOrigins).toHaveLength(followerOriginsBeforeFrame)

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('lands in the root the mutations name, not the workflow id', () => {
    const root = toRootGraphId('root-graph-42')
    const adapter = new EcsFollowerAdapter(
      recordingMutations(() => root)
    )
    const host = mintHost()
    const follower = new FollowerDoc()
    adapter.bind('wf', follower)
    const update = frameFrom(host, follower)
    follower.applyRemoteUpdate(update)
    adapter.applyFrame({ workflowId: 'wf', seq: 1, update })

    expect(Object.keys(semanticDocs.readGraph(root).nodes).sort()).toEqual([
      '1',
      '2'
    ])
    expect(semanticDocs.has(toRootGraphId('wf'))).toBe(false)

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('skips the merge while the target has no root', () => {
    const adapter = new EcsFollowerAdapter(recordingMutations(() => null))
    const host = mintHost()
    const follower = new FollowerDoc()
    adapter.bind('wf', follower)
    const update = frameFrom(host, follower)
    follower.applyRemoteUpdate(update)
    adapter.applyFrame({ workflowId: 'wf', seq: 1, update })

    expect(semanticDocs.has(toRootGraphId('wf'))).toBe(false)

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })

  it('catches up from the follower doc after a frame it dropped unbound', () => {
    const host = mintHost()
    const follower = new FollowerDoc()
    const adapter = new EcsFollowerAdapter(recordingMutations())
    const root = toRootGraphId('wf')

    // Seed arrives before bind: the follower doc has it, the adapter drops it.
    const seed = frameFrom(host, follower)
    follower.applyRemoteUpdate(seed)
    expect(adapter.applyFrame({ workflowId: 'wf', seq: 1, update: seed })).toBe(
      false
    )
    expect(semanticDocs.has(root)).toBe(false)

    // A later host edit that depends on the seed structs.
    host.transact(() => {
      nodesMap(host).get('1')?.set('title', 'renamed')
    })
    const edit = frameFrom(host, follower)
    follower.applyRemoteUpdate(edit)

    adapter.bind('wf', follower)
    expect(adapter.applyFrame({ workflowId: 'wf', seq: 2, update: edit })).toBe(
      true
    )

    const target = semanticDocs.ensure(root)
    expect(Object.keys(semanticDocs.readGraph(root).nodes).sort()).toEqual([
      '1',
      '2'
    ])
    expect(nodesMap(target).get('1')?.get('title')).toBe('renamed')
    expect(target.store.pendingStructs).toBeNull()

    adapter.destroy()
    follower.destroy()
    host.destroy()
  })
})
