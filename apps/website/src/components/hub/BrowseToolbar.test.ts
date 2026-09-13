// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useHubStore } from '../../composables/useHubStore'
import BrowseToolbar from './BrowseToolbar.vue'

const labels = {
  all: 'All',
  nodeGraphs: 'Node graphs',
  comfyApps: 'Comfy apps',
  models: 'Models',
  filter: 'Filter',
  clearAll: 'Clear all',
  searchPlaceholder: 'Search',
  noResults: 'No results',
  less: 'Less',
  selected: '{n} selected',
  typeAll: 'All types',
  showResults: 'Show results',
  showModels: 'Show models'
}

describe('BrowseToolbar', () => {
  beforeEach(() => useHubStore().reset())

  it('still renders its browsing controls with no sort options', () => {
    render(BrowseToolbar, {
      props: {
        templates: [],
        facetsConfig: [],
        labels,
        sortOptions: [],
        resultCount: 0
      }
    })

    expect(screen.getByRole('tab', { name: 'All' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Filter' })).toBeTruthy()
  })
})
