import { describe, expect, it } from 'vitest'

import { parseSuperGraphDocument } from './documentSchema'
import { docWith, edge, fileItem, generateNode, ioNode } from './engineFixtures'
import { textItem } from './items'

describe(parseSuperGraphDocument, () => {
  it('[R4b] content collected from upstream survives a document save and parse', () => {
    const doc = docWith(
      [
        generateNode('gen', 'image'),
        ioNode('results', 'image', [
          {
            kind: 'file',
            modality: 'image',
            ref: {
              filename: 'run_00001_.png',
              subfolder: 'supercomfy',
              type: 'output'
            }
          },
          fileItem('upload.png')
        ]),
        ioNode('notes', 'text', [textItem('a lighthouse at dusk')])
      ],
      [edge('gen', 'out', 'results', 'in')]
    )

    const saved: unknown = JSON.parse(JSON.stringify(doc))

    expect(parseSuperGraphDocument(saved)).toEqual({ ok: true, doc })
  })

  it('refuses a file that is not a SuperComfy document and names the problem', () => {
    const parsed = parseSuperGraphDocument({ version: 2, nodes: [] })

    expect(parsed).toMatchObject({
      ok: false,
      issues: expect.arrayContaining([expect.stringContaining('version')])
    })
  })
})
