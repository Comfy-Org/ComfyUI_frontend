import { describe, expect, it } from 'vitest'

import { docWith, edge, generateNode, ioNode, port } from './engineFixtures'
import { canConnect } from './graphTopology'

describe(canConnect, () => {
  it.for([
    {
      title: '[C1] refuses a wire that would make a cycle',
      doc: docWith(
        [
          generateNode('first', 'image', { inputs: [port('image', 'image')] }),
          generateNode('second', 'image', { inputs: [port('image', 'image')] })
        ],
        [edge('first', 'out', 'second', 'image')]
      ),
      from: { node: 'second', port: 'out' },
      to: { node: 'first', port: 'image' },
      expected: { ok: false, reason: 'cycle' }
    },
    {
      title: '[C2] refuses a wire between different modalities',
      doc: docWith([
        ioNode('clips', 'video'),
        generateNode('gen', 'image', { inputs: [port('image', 'image')] })
      ]),
      from: { node: 'clips', port: 'out' },
      to: { node: 'gen', port: 'image' },
      expected: { ok: false, reason: 'modality' }
    },
    {
      title: "[C4] refuses a wire past a multi input's max",
      doc: docWith(
        [
          ioNode('first', 'image'),
          ioNode('second', 'image'),
          ioNode('third', 'image'),
          generateNode('gen', 'image', {
            inputs: [port('refs', 'image', { multi: true, max: 2 })]
          })
        ],
        [
          edge('first', 'out', 'gen', 'refs'),
          edge('second', 'out', 'gen', 'refs')
        ]
      ),
      from: { node: 'third', port: 'out' },
      to: { node: 'gen', port: 'refs' },
      expected: { ok: false, reason: 'full' }
    }
  ])('$title', ({ doc, from, to, expected }) => {
    expect(canConnect(doc, from, to)).toEqual(expected)
  })
})
