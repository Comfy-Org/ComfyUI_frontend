/**
 * Layout stays out of the shared semantic document.
 *
 * Extracted from the architecture guard in PR #18435 (CRDT-STORES-0036), a
 * stack that is parked rather than landing. The two assertions in that guard
 * which described the parked design -- "the semantic stores are projections of
 * a Yjs document" and "a remote update merges without a GraphMutations round
 * trip" -- are deliberately not carried over: they assert an implementation
 * that is not shipping.
 *
 * What is carried over is the boundary that guard protected, and that boundary
 * is independent of how a remote op reaches the graph. Layout and view state
 * live in a separate frontend-owned Yjs document; the semantic document carries
 * nodes and links and nothing positional. Restated in the program's CRDT
 * invariant list as KEEP-ALIVE #8, and explicitly preserved by the remote-apply
 * pivot ("layout stays in its own FE-owned doc").
 *
 * Deliberately written against the shared `mint()` and plain Yjs rather than
 * against the follower adapter, so it keeps its meaning once remote apply moves
 * onto the graph API and the reconciliation layer is deleted.
 */
import { mint } from '@comfyorg/comfy-multi-player'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

const SRC_DIR = path.resolve(__dirname, '../../../../')
const STORES_DIR = path.join(SRC_DIR, 'stores')
const LAYOUT_STORE = path.join(
  SRC_DIR,
  'renderer/core/layout/store/layoutStore.ts'
)

/** The three stores that hold semantic graph state. */
const SEMANTIC_STORES = [
  'nodeDataStore.ts',
  'linkStore.ts',
  'widgetValueStore.ts'
] as const

const YJS_IMPORT = /from\s+['"]yjs['"]/
const LAYOUT_STORE_IMPORT = /layout\/store\/layoutStore/
const POSITIONAL_ROOT = /layout|viewport|position|pan|zoom/i

function readSource(file: string): string {
  return readFileSync(file, 'utf8')
}

/** Roots a peer would actually receive, not the roots the sender declared. */
function deliveredRoots(host: Y.Doc): string[] {
  const peer = new Y.Doc()
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(host))
  const roots = [...peer.share.keys()]
  peer.destroy()
  return roots
}

describe('layout stays out of the semantic document', () => {
  it('layoutStore owns its own Yjs document', () => {
    expect(readSource(LAYOUT_STORE)).toMatch(YJS_IMPORT)
  })

  it.for(SEMANTIC_STORES)('%s does not reach into layoutStore', (file) => {
    expect(readSource(path.join(STORES_DIR, file))).not.toMatch(
      LAYOUT_STORE_IMPORT
    )
  })

  it('a minted workflow ships nodes and links, and nothing positional', () => {
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'Source',
            pos: [640, 480],
            inputs: [],
            outputs: [{ name: 'out', type: 'IMAGE', links: [9] }]
          },
          {
            id: 2,
            type: 'Sink',
            pos: [1200, 480],
            inputs: [{ name: 'image', type: 'IMAGE', link: 9 }],
            outputs: []
          }
        ],
        links: [[9, 1, 0, 2, 0, 'IMAGE']]
      },
      { types: {} }
    )

    const roots = deliveredRoots(host)
    host.destroy()

    // Yjs only ships roots that carry content, so assert the semantic roots
    // arrived before concluding anything from the absence of the others.
    expect(roots).toEqual(expect.arrayContaining(['nodes', 'links']))
    expect(roots.filter((root) => POSITIONAL_ROOT.test(root))).toEqual([])
  })

  /**
   * Characterization, not an aspiration. The separation above holds at the
   * root level, but a minted node payload still carries `pos` and `size`
   * verbatim, so geometry is present inside the semantic document even though
   * `layoutStore` is what the canvas actually reads.
   *
   * Two defensible readings, and this test deliberately does not pick one:
   * the payload is copied verbatim so a peer can place a node it has never
   * seen (never re-derived from a schema), or geometry does not belong in the
   * semantic document at all. If the second reading wins, this test goes red
   * and the message is the reason why.
   */
  it('a minted node payload still carries pos and size verbatim', () => {
    const host = mint(
      {
        nodes: [
          {
            id: 1,
            type: 'Source',
            pos: [640, 480],
            size: [210, 60],
            inputs: [],
            outputs: []
          }
        ],
        links: []
      },
      { types: {} }
    )

    const node = host.getMap('nodes').get('1')
    const payload = node instanceof Y.Map ? node.toJSON() : node
    host.destroy()

    expect(payload).toMatchObject({ pos: [640, 480], size: [210, 60] })
  })
})
