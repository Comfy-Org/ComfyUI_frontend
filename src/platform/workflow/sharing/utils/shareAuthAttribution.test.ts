import { beforeEach, describe, expect, it } from 'vitest'
import type { LocationQuery } from 'vue-router'

import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

import {
  isValidShareId,
  preserveLoggedOutShareAuthAttribution
} from './shareAuthAttribution'

const SHARE_AUTH_NAMESPACE = PRESERVED_QUERY_NAMESPACES.SHARE_AUTH
const invalidShareQueries: Array<{ name: string; query: LocationQuery }> = [
  { name: 'missing', query: {} },
  { name: 'array value', query: { share: ['share-id-1'] } },
  { name: 'invalid characters', query: { share: '../share-id-1' } },
  { name: 'too long', query: { share: 'a'.repeat(129) } }
]

describe('shareAuthAttribution', () => {
  beforeEach(() => {
    clearPreservedQuery(SHARE_AUTH_NAMESPACE)
    sessionStorage.clear()
  })

  it('preserves a valid share id for logged-out users', () => {
    preserveLoggedOutShareAuthAttribution({ share: 'share-id_1.2' }, false)

    expect(getPreservedQueryParam(SHARE_AUTH_NAMESPACE, 'share')).toBe(
      'share-id_1.2'
    )
    expect(sessionStorage.getItem('Comfy.PreservedQuery.share_auth')).toContain(
      'share-id_1.2'
    )
  })

  it('does not preserve share attribution for logged-in users', () => {
    preserveLoggedOutShareAuthAttribution({ share: 'share-id-1' }, true)

    expect(
      getPreservedQueryParam(SHARE_AUTH_NAMESPACE, 'share')
    ).toBeUndefined()
    expect(sessionStorage.getItem('Comfy.PreservedQuery.share_auth')).toBeNull()
  })

  it.for(invalidShareQueries)(
    'does not preserve $name share params',
    ({ query }) => {
      preserveLoggedOutShareAuthAttribution(query, false)

      expect(
        getPreservedQueryParam(SHARE_AUTH_NAMESPACE, 'share')
      ).toBeUndefined()
      expect(
        sessionStorage.getItem('Comfy.PreservedQuery.share_auth')
      ).toBeNull()
    }
  )

  it.for([
    { shareId: 'abc123', expected: true },
    { shareId: 'share-id_1.2', expected: true },
    { shareId: 'a'.repeat(128), expected: true },
    { shareId: '../share-id-1', expected: false },
    { shareId: '.', expected: false },
    { shareId: '..', expected: false },
    { shareId: '-share-id', expected: false },
    { shareId: 'share id', expected: false },
    { shareId: '\u5171\u4eab', expected: false },
    { shareId: 'a'.repeat(129), expected: false },
    { shareId: '', expected: false }
  ])('validates "$shareId" as $expected', ({ shareId, expected }) => {
    expect(isValidShareId(shareId)).toBe(expected)
  })
})
