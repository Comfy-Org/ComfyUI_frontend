import { describe, expect, it } from 'vitest'

import {
  containerNamesPublishing,
  isWidgetCatalog
} from './dev-agent-record-mode'

describe('containerNamesPublishing', () => {
  const dockerPs = `cloud-postgres-1 postgres:16 0.0.0.0:54331->5432/tcp
cloud-redis-1 redis:7 0.0.0.0:6379->6379/tcp
`

  it('names the container publishing the requested port', () => {
    expect(containerNamesPublishing(dockerPs, 'postgres', 54331)).toEqual([
      'cloud-postgres-1'
    ])
  })

  it('tolerates the trailing blank row docker ps always emits', () => {
    expect(containerNamesPublishing(dockerPs, 'mysql', 3306)).toEqual([])
    expect(containerNamesPublishing('', 'postgres', 54331)).toEqual([])
  })
})

describe('isWidgetCatalog', () => {
  it('accepts the pinned catalog shape', () => {
    expect(
      isWidgetCatalog({ types: { KSampler: { widget_order: ['seed'] } } })
    ).toBe(true)
  })

  it.for([
    ['a truthy non-catalog', 'catalog.json'],
    ['a catalog with no types map', { comment: 'pinned' }],
    ['an entry with no widget_order', { types: { KSampler: {} } }],
    [
      'a widget_order holding non-strings',
      { types: { KSampler: { widget_order: [1] } } }
    ]
  ] as const)('rejects %s', ([, value]) => {
    expect(isWidgetCatalog(value)).toBe(false)
  })
})
