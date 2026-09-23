import { describe, expect, it } from 'vitest'

import { useWorkflowTemplatesStore } from './workflowTemplatesStore'

describe('workflowTemplatesStore', () => {
  it.for([
    {
      availability: 'available',
      isLoaded: true,
      requested: 'all',
      expected: 'all'
    },
    {
      availability: 'stale with Popular available',
      isLoaded: true,
      requested: 'removed-category',
      expected: 'popular'
    },
    {
      availability: 'unavailable before categories load',
      isLoaded: false,
      requested: 'removed-category',
      expected: 'all'
    }
  ])(
    'resolves an $availability requested category to $expected',
    ({ isLoaded, requested, expected }) => {
      const store = useWorkflowTemplatesStore()
      store.isLoaded = isLoaded

      expect(store.resolveCategoryId(requested)).toBe(expected)
    }
  )
})
