import { describe, expect, it } from 'vitest'

import { nodeTitle } from './nodePayload'

describe('nodeTitle', () => {
  it.for([
    { title: undefined, type: 'Unregistered', expected: 'Unregistered' },
    { title: '', type: 'Unregistered', expected: 'Unregistered' },
    { title: 'Explicit', type: 'Unregistered', expected: 'Explicit' }
  ] as const)(
    'resolves ($title, $type) to $expected with no incumbent to fall back on',
    ({ title, type, expected }) => {
      expect(nodeTitle(title, type)).toBe(expected)
    }
  )

  // `nodeTitle` takes only the doc payload's title and the node's type. It
  // has no incumbent-title parameter, so `prepareNode` (in
  // `graphMutations.ts`) can never keep a node's live title across a
  // reconcile whose payload omits one — exactly what happens when a canvas
  // rename never reached the doc in the first place.
  it.fails('falls back to an incumbent title when the payload carries none', () => {
    const incumbentTitle = 'My Renamed Sampler'
    expect(nodeTitle(undefined, 'Unregistered')).toBe(incumbentTitle)
  })
})
