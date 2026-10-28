import { mint } from '@comfyorg/comfy-multi-player'
import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'

const POSITIONAL_ROOTS = [
  'layout',
  'viewport',
  'position',
  'pan',
  'zoom',
  'pos',
  'size'
]

function deliveredRoots(host: Y.Doc): string[] {
  const peer = new Y.Doc()
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(host))
  const roots = [...peer.share.keys()]
  peer.destroy()
  return roots
}

describe('layout stays out of the semantic document', () => {
  it('ships nodes and links without known positional roots', () => {
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

    expect(roots).toEqual(expect.arrayContaining(['nodes', 'links']))
    expect(roots.filter((root) => POSITIONAL_ROOTS.includes(root))).toEqual([])
  })

  it.fails('omits pos and size from a minted node payload', () => {
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
    const payload = node instanceof Y.Map ? node.toJSON() : {}
    host.destroy()

    expect(
      Object.keys(payload).filter((key) => key === 'pos' || key === 'size')
    ).toEqual([])
  })
})
