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

  it('merges newly captured keys into the payload when merge is set', () => {
    capturePreservedQuery(
      NAMESPACE,
      { template: 'flux' },
      ['template', 'source', 'mode'],
      { merge: true }
    )

    capturePreservedQuery(
      NAMESPACE,
      { source: 'custom' },
      ['template', 'source', 'mode'],
      { merge: true }
    )

    const merged = mergePreservedQueryIntoQuery(NAMESPACE)
    expect(merged).toEqual({ template: 'flux', source: 'custom' })
  })

  it('replaces the whole payload on capture by default', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux', source: 'custom' }, [
      'template',
      'source',
      'mode'
    ])

    capturePreservedQuery(NAMESPACE, { template: 'sdxl' }, [
      'template',
      'source',
      'mode'
    ])

    expect(mergePreservedQueryIntoQuery(NAMESPACE)).toEqual({
      template: 'sdxl'
    })
  })

  it('leaves the payload untouched when a default capture has no valid values', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux' }, ['template'])

    capturePreservedQuery(NAMESPACE, { template: '' }, ['template'])

    expect(getPreservedQueryParam(NAMESPACE, 'template')).toBe('flux')
  })

  it('captures the first non-empty string element of an array-valued param', () => {
    capturePreservedQuery(NAMESPACE, { template: ['', 'flux', 'sdxl'] }, [
      'template'
    ])

    expect(getPreservedQueryParam(NAMESPACE, 'template')).toBe('flux')
  })

  it('does not stash empty, null, or all-junk array values', () => {
    capturePreservedQuery(
      NAMESPACE,
      { template: '', source: null, mode: ['', null] },
      ['template', 'source', 'mode']
    )

    expect(getPreservedQueryParam(NAMESPACE, 'template')).toBeUndefined()
    expect(getPreservedQueryParam(NAMESPACE, 'source')).toBeUndefined()
    expect(getPreservedQueryParam(NAMESPACE, 'mode')).toBeUndefined()
    expect(mergePreservedQueryIntoQuery(NAMESPACE)).toBeUndefined()
  })

  it('removes a preserved key on empty value when merge is set', () => {
    capturePreservedQuery(
      NAMESPACE,
      { template: 'flux', source: 'custom' },
      ['template', 'source'],
      { merge: true }
    )

    capturePreservedQuery(NAMESPACE, { template: '' }, ['template', 'source'], {
      merge: true
    })

    expect(getPreservedQueryParam(NAMESPACE, 'template')).toBeUndefined()
    expect(mergePreservedQueryIntoQuery(NAMESPACE)).toEqual({
      source: 'custom'
    })
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

  it('overwrites an array-valued live query key with the stashed string', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux' }, ['template'])

    const merged = mergePreservedQueryIntoQuery(NAMESPACE, {
      template: ['existing', 'other']
    })

    expect(merged).toEqual({ template: 'flux' })
  })

  it('clears cached payload', () => {
    capturePreservedQuery(NAMESPACE, { template: 'flux' }, ['template'])

    clearPreservedQuery(NAMESPACE)

    const merged = mergePreservedQueryIntoQuery(NAMESPACE)
    expect(merged).toBeUndefined()
    expect(sessionStorage.getItem('Comfy.PreservedQuery.template')).toBeNull()
  })
})
