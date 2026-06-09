import { beforeEach, describe, expect, it } from 'vitest'

import {
  capturePreservedQuery,
  clearPreservedQuery,
  getPreservedQueryParam,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

const NAMESPACE = PRESERVED_QUERY_NAMESPACES.TEMPLATE

describe('preservedQueryManager', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearPreservedQuery(NAMESPACE)
  })

  it('captures specified keys from the route query', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux', source: 'custom' }, [
      'template',
      'source'
    ])

    hydratePreservedQuery(NAMESPACE)
    const merged = mergePreservedQueryIntoQuery(NAMESPACE)

    expect(merged).toEqual({ template: 'flux', source: 'custom' })
    expect(sessionStorage.getItem('Comfy.PreservedQuery.template')).toBeTruthy()
  })

  it('reads a preserved query param by key', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux' }, ['template'])

    expect(getPreservedQueryParam(NAMESPACE, 'template')).toBe('flux')
    expect(getPreservedQueryParam(NAMESPACE, 'source')).toBeUndefined()
  })

  it('hydrates from sessionStorage when reading a param', () => {
    sessionStorage.setItem(
      'Comfy.PreservedQuery.template',
      JSON.stringify({ template: 'flux' })
    )

    expect(getPreservedQueryParam(NAMESPACE, 'template')).toBe('flux')
  })

  it('hydrates cached payload from sessionStorage once', () => {
    sessionStorage.setItem(
      'Comfy.PreservedQuery.template',
      JSON.stringify({ template: 'flux', source: 'default' })
    )

    hydratePreservedQuery(NAMESPACE)
    const merged = mergePreservedQueryIntoQuery(NAMESPACE)

    expect(merged).toEqual({ template: 'flux', source: 'default' })
  })

  it('merges stored payload only when query lacks the keys', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux' }, ['template'])

    const merged = mergePreservedQueryIntoQuery(NAMESPACE, {
      foo: 'bar'
    })

    expect(merged).toEqual({ foo: 'bar', template: 'flux' })
  })

  it('returns undefined when merge does not change query', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux' }, ['template'])

    const merged = mergePreservedQueryIntoQuery(NAMESPACE, {
      template: 'existing'
    })

    expect(merged).toBeUndefined()
  })

  it('clears cached payload', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux' }, ['template'])

    clearPreservedQuery(NAMESPACE)

    const merged = mergePreservedQueryIntoQuery(NAMESPACE)
    expect(merged).toBeUndefined()
    expect(sessionStorage.getItem('Comfy.PreservedQuery.template')).toBeNull()
  })
})
