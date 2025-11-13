import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { usePreservedQueryStore } from '@/platform/navigation/preservedQueryStore'

describe('preservedQueryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
  })

  it('captures specified keys from the route query', () => {
    const store = usePreservedQueryStore()

    store.capture('template', { template: 'flux', source: 'custom' }, [
      'template',
      'source'
    ])

    expect(store.getPayload('template')).toEqual({
      template: 'flux',
      source: 'custom'
    })

    expect(sessionStorage.getItem('Comfy.PreservedQuery.template')).toBeTruthy()
  })

  it('hydrates intent from sessionStorage only once', () => {
    sessionStorage.setItem(
      'Comfy.PreservedQuery.template',
      JSON.stringify({ template: 'flux', source: 'default' })
    )

    const store = usePreservedQueryStore()
    store.hydrate('template')

    expect(store.getPayload('template')).toEqual({
      template: 'flux',
      source: 'default'
    })
  })

  it('merges stored intent into an empty query', () => {
    const store = usePreservedQueryStore()
    store.capture('template', { template: 'flux' }, ['template'])

    const merged = store.mergeIntoQuery('template')
    expect(merged).toEqual({ template: 'flux' })
  })

  it('does not override explicit params already in the query', () => {
    const store = usePreservedQueryStore()
    store.capture('template', { template: 'flux' }, ['template'])

    const merged = store.mergeIntoQuery('template', {
      template: 'new'
    })

    expect(merged).toBeNull()
  })

  it('clears intent from memory and storage', () => {
    const store = usePreservedQueryStore()
    store.capture('template', { template: 'flux' }, ['template'])

    store.clear('template')

    expect(store.getPayload('template')).toBeNull()
    expect(sessionStorage.getItem('Comfy.PreservedQuery.template')).toBeNull()
  })
})
