import { describe, expect, it } from 'vitest'

import { auditCatalogSafety } from './catalog-validation'

describe('catalog safety', () => {
  it.for([
    'Hello {',
    'mail@example.com',
    '<script>alert(1)</script>',
    '<a href="javascript:alert(1)">Click</a>',
    '<img src="image.png" onerror="alert(1)">'
  ])('rejects invalid messages or unsafe HTML: %s', (message) => {
    expect(
      auditCatalogSafety({ nested: { message } }, 'main.json')
    ).not.toEqual([])
  })

  it('accepts nested arrays, plurals, named and literal interpolation, links and intentional empty messages', () => {
    expect(
      auditCatalogSafety(
        {
          list: ['Hello {name}', ["mail{'@'}example.com", '@:message']],
          plural: 'One item | {count} items',
          link: '<a href="/pricing">Pricing</a>',
          empty: '',
          count: 2,
          enabled: true,
          unset: null
        },
        'main.json'
      )
    ).toEqual([])
  })

  it('keeps raw node slot tooltips out of the compiler, while checking compiled node text', () => {
    const catalog = {
      node: {
        inputs: { image: { tooltip: 'raw { @', name: 'broken {' } },
        outputs: { '0': { tooltip: 'raw { @', name: 'Output' } },
        description: 'broken {'
      }
    }
    expect(auditCatalogSafety(catalog, 'nodeDefs.json')).toEqual([
      expect.stringContaining('node.inputs.image.name: invalid message'),
      expect.stringContaining('node.description: invalid message')
    ])
    expect(auditCatalogSafety(catalog, 'main.json')).toEqual(
      expect.arrayContaining([
        expect.stringContaining('node.inputs.image.tooltip: invalid message'),
        expect.stringContaining('node.outputs.0.tooltip: invalid message')
      ])
    )
  })
})
