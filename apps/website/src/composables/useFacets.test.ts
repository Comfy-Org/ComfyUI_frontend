import { ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useFacets } from './useFacets'
import { useHubStore } from './useHubStore'

describe('useFacets', () => {
  beforeEach(() => useHubStore().reset())

  it('counts a repeated value once per template and tracks active badges by type', () => {
    const templates = ref([
      { tags: ['portrait', 'portrait'], models: ['Flux'], mediaType: 'image' },
      { tags: ['portrait'], models: ['Kling'], mediaType: 'video' }
    ])
    const facets = useFacets(templates)

    expect(facets.facetsByType.value.tag.values).toEqual([
      { value: 'portrait', displayValue: 'portrait', count: 2 }
    ])

    const store = useHubStore()
    store.toggleBadge({ type: 'tag', value: 'portrait' })
    store.toggleBadge({ type: 'model', value: 'Flux' })
    expect(facets.isBadgeActive('tag', 'portrait')).toBe(true)
    expect(facets.isBadgeActive('tag', 'landscape')).toBe(false)
    expect(facets.activeCountForType('tag')).toBe(1)
    expect(facets.activeCountForType('model')).toBe(1)
    expect(facets.activeCountForType('media')).toBe(0)
  })
})
