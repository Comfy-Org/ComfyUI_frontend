import { beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { captureWorkshopEvent } from '@/scripts/posthog'
import {
  SEARCH_SETTLE_MS,
  useHubCatalogueTracking
} from './useHubCatalogueTracking'

vi.mock(import('@/scripts/posthog'))

function setup() {
  const query = ref('')
  const useCases = ref<string[]>([])
  const sort = ref('popular')
  const scope = effectScope()
  const tracking = scope.run(() =>
    useHubCatalogueTracking('models', {
      query,
      resultsCount: () => 7,
      filters: [
        ['use_case', () => useCases.value],
        ['sort', () => sort.value]
      ]
    })
  )
  if (!tracking) throw new Error('tracking did not start')
  return { query, useCases, sort, scope, ...tracking }
}

function type(query: { value: string }, text: string) {
  for (const character of text) {
    query.value += character
    vi.advanceTimersByTime(100)
  }
}

const searched = (query: string, length = query.length) => ({
  name: 'hub_search_performed',
  properties: {
    surface: 'models',
    query,
    query_length: length,
    results_count: 7
  }
})

describe('useHubCatalogueTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(captureWorkshopEvent).mockClear()
  })

  it('reports a search once typing settles, not per keystroke', () => {
    const { query } = setup()
    type(query, 'flux')
    expect(captureWorkshopEvent).not.toHaveBeenCalled()

    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).toHaveBeenCalledOnce()
    expect(captureWorkshopEvent).toHaveBeenCalledWith(searched('flux'))
  })

  it('reports at once on Enter and not again when the query settles', () => {
    const { query, submitSearch } = setup()
    type(query, 'Wan')
    submitSearch()
    expect(captureWorkshopEvent).toHaveBeenCalledWith(searched('wan'))

    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    submitSearch()
    expect(captureWorkshopEvent).toHaveBeenCalledOnce()
  })

  it('trims, lowercases and caps the query but keeps its full length', () => {
    const { query } = setup()
    query.value = `  ${'A'.repeat(120)}  `
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).toHaveBeenCalledWith(
      searched('a'.repeat(100), 120)
    )
  })

  it('reports a search again only after the query changes', () => {
    const { query } = setup()
    query.value = 'flux'
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    query.value = 'flux '
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).toHaveBeenCalledOnce()

    query.value = ''
    query.value = 'flux'
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).toHaveBeenCalledTimes(2)
  })

  it('drops a search cleared or left before it settles', () => {
    const { query, scope } = setup()
    type(query, 'flu')
    query.value = ''
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    type(query, 'kling')
    scope.stop()
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()
  })

  it('reports each filter the visitor changes with what it replaced', () => {
    const { useCases, sort } = setup()
    useCases.value = ['edit-images']
    useCases.value = ['edit-images', 'audio']
    useCases.value = []
    sort.value = 'name'

    expect(vi.mocked(captureWorkshopEvent).mock.calls).toEqual([
      [filtered('use_case', 'edit-images', 'all')],
      [filtered('use_case', 'edit-images,audio', 'edit-images')],
      [filtered('use_case', 'all', 'edit-images,audio')],
      [filtered('sort', 'name', 'popular')]
    ])
  })

  it('stays silent for what the page sets itself', () => {
    const { query, useCases, quietly } = setup()
    quietly(() => {
      query.value = 'wan'
      useCases.value = ['generate-videos']
    })
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).not.toHaveBeenCalled()

    query.value = 'wan 2'
    vi.advanceTimersByTime(SEARCH_SETTLE_MS)
    expect(captureWorkshopEvent).toHaveBeenCalledWith(searched('wan 2'))
  })
})

function filtered(filter: string, value: string, previous: string) {
  return {
    name: 'hub_filter_changed',
    properties: {
      surface: 'models',
      filter,
      value,
      previous_value: previous
    }
  }
}
