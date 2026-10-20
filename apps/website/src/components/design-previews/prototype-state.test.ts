import { describe, expect, it } from 'vitest'

import type { PrototypeField } from './PrototypeSwitcher.vue'
import { resolvePrototypeState } from './prototype-state'

const fields: readonly PrototypeField<'cloud' | 'faq'>[] = [
  {
    key: 'cloud',
    label: 'Availability',
    options: [
      { value: 'yes', label: 'Try in Cloud' },
      { value: 'no', label: 'Local only' }
    ]
  },
  {
    key: 'faq',
    label: 'FAQ',
    options: [
      { value: 'yes', label: 'FAQ' },
      { value: 'no', label: 'No FAQ' }
    ]
  }
]
const defaults = { cloud: 'yes', faq: 'yes' }

describe('resolvePrototypeState', () => {
  it.for([
    {
      name: 'uses the defaults when nothing is set',
      query: '',
      saved: {},
      expected: { cloud: 'yes', faq: 'yes' }
    },
    {
      name: 'prefers the URL over the saved choice',
      query: 'cloud=no',
      saved: { cloud: 'yes', faq: 'no' },
      expected: { cloud: 'no', faq: 'no' }
    },
    {
      name: 'falls back past a value that is not an option',
      query: 'cloud=maybe',
      saved: { cloud: 'no' },
      expected: { cloud: 'no', faq: 'yes' }
    }
  ])('$name', ({ query, saved, expected }) => {
    expect(
      resolvePrototypeState(fields, defaults, new URLSearchParams(query), saved)
    ).toEqual(expected)
  })
})
