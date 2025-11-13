import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { useTemplateIntentStore } from '@/stores/templateIntentStore'

describe('templateIntentStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sessionStorage.clear()
  })

  it('captures template intent from query and persists it', () => {
    const store = useTemplateIntentStore()

    store.captureFromQuery({ template: 'flux', source: 'custom' })

    expect(store.template).toBe('flux')
    expect(store.source).toBe('custom')

    const stored = JSON.parse(
      sessionStorage.getItem('Comfy.TemplateIntent') || 'null'
    )

    expect(stored).toEqual({ template: 'flux', source: 'custom' })
  })

  it('hydrates from sessionStorage when present', () => {
    sessionStorage.setItem(
      'Comfy.TemplateIntent',
      JSON.stringify({ template: 'flux', source: 'default' })
    )

    const store = useTemplateIntentStore()
    expect(store.template).toBeUndefined()

    store.hydrateFromStorage()

    expect(store.template).toBe('flux')
    expect(store.source).toBe('default')
  })

  it('merges intent into query when missing', () => {
    const store = useTemplateIntentStore()
    store.captureFromQuery({ template: 'flux', source: 'default' })

    const merged = store.mergeIntoQuery({ foo: 'bar' })

    expect(merged).toEqual({ foo: 'bar', template: 'flux', source: 'default' })
  })

  it('does not override explicit template in query', () => {
    const store = useTemplateIntentStore()
    store.captureFromQuery({ template: 'flux', source: 'default' })

    const merged = store.mergeIntoQuery({ template: 'new', foo: 'bar' })

    expect(merged).toEqual({ template: 'new', foo: 'bar' })
  })

  it('clears intent and sessionStorage', () => {
    const store = useTemplateIntentStore()
    store.captureFromQuery({ template: 'flux', source: 'default' })

    store.clearIntent()

    expect(store.template).toBeUndefined()
    expect(sessionStorage.getItem('Comfy.TemplateIntent')).toBeNull()
  })
})
