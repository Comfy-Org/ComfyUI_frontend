import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

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

  it('preserves a loaded extension category ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({}))
    )
    vi.spyOn(api, 'getWorkflowTemplates').mockResolvedValue({
      'custom-module': ['example']
    })
    vi.spyOn(api, 'getCoreWorkflowTemplates').mockResolvedValue([])
    const store = useWorkflowTemplatesStore()

    await store.loadWorkflowTemplates()

    expect(store.resolveCategoryId('extension-custom-module')).toBe(
      'extension-custom-module'
    )
  })
})
