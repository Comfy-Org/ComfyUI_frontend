/**
 * Architecture guard for CRDT-STORES-0036 (docs/adr).
 *
 * The ADR's end state is that the three semantic stores are Yjs-backed and a
 * remote update merges into them directly, without being re-derived through
 * `GraphMutations.batch`. Those two assertions are marked `it.fails` until the
 * slices that deliver them land; the slice that flips them must drop the
 * marker in the same change. The remaining assertions hold today and protect
 * the boundaries the migration must not move.
 */
import { mint } from '@comfyorg/comfy-multi-player'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import type { GraphMutations } from './graphMutations'

const STORES_DIR = path.resolve(__dirname, '../../../../stores')
const LAYOUT_STORE = path.resolve(
  __dirname,
  '../../../../renderer/core/layout/store/layoutStore.ts'
)
const SEMANTIC_STORES = [
  'nodeDataStore.ts',
  'linkStore.ts',
  'widgetValueStore.ts'
] as const

const YJS_IMPORT = /from\s+['"]yjs['"]/

function readSource(file: string): string {
  return readFileSync(file, 'utf8')
}

function recordingMutations(): GraphMutations & {
  batch: ReturnType<typeof vi.fn>
} {
  return {
    batch: vi.fn(() => true),
    addNode: vi.fn(() => true),
    setWidget: vi.fn(() => true),
    connect: vi.fn(() => true),
    deleteNode: vi.fn(() => true),
    clearSemanticGraph: vi.fn(() => true)
  }
}

function deliverSeed(mutations: GraphMutations) {
  const host = mint(
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
  const follower = new FollowerDoc()
  const adapter = new EcsFollowerAdapter(mutations)
  adapter.bind('wf', follower)
  const update = Y.encodeStateAsUpdate(host, follower.stateVector())
  follower.applyRemoteUpdate(update)
  const committed = adapter.applyFrame({ workflowId: 'wf', seq: 1, update })
  const roots = [...follower.doc.share.keys()]
  adapter.destroy()
  follower.destroy()
  host.destroy()
  return { committed, roots }
}

describe('CRDT-STORES-0036 semantic store architecture guard', () => {
  for (const file of SEMANTIC_STORES) {
    it.fails(`KNOWN GAP: ${file} is a projection of a Yjs document`, () => {
      expect(readSource(path.join(STORES_DIR, file))).toMatch(YJS_IMPORT)
    })
  }

  it.fails('KNOWN GAP: a remote update merges without a GraphMutations.batch round trip', () => {
    const mutations = recordingMutations()
    deliverSeed(mutations)
    expect(mutations.batch).not.toHaveBeenCalled()
  })

  it('layoutStore keeps its own Yjs document', () => {
    expect(readSource(LAYOUT_STORE)).toMatch(YJS_IMPORT)
  })

  it('the semantic stores do not reach into layoutStore', () => {
    for (const file of SEMANTIC_STORES) {
      expect(readSource(path.join(STORES_DIR, file))).not.toMatch(
        /layout\/store\/layoutStore/
      )
    }
  })

  it('a follower filled from a minted host carries schema v1 roots and no layout root', () => {
    const mutations = recordingMutations()
    const { committed, roots } = deliverSeed(mutations)
    expect(committed).toBe(true)
    // Yjs only ships roots that carry content; empty schema roots stay local.
    expect(roots).toEqual(expect.arrayContaining(['nodes', 'links']))
    expect(roots.filter((root) => /layout|viewport/i.test(root))).toEqual([])
  })
})
