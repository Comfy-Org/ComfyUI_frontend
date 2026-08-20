import { beforeEach, describe, expect, test } from 'vitest'
import type { LocationQuery } from 'vue-router'

import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { PRESERVED_QUERY_NAMESPACES } from '@/platform/navigation/preservedQueryNamespaces'

import { resolveUnauthenticatedRedirectName } from './inviteRedirect'

const stashInvite = (token: string) => {
  sessionStorage.setItem(
    `Comfy.PreservedQuery.${PRESERVED_QUERY_NAMESPACES.INVITE}`,
    JSON.stringify({ invite: token })
  )
}

describe('resolveUnauthenticatedRedirectName', () => {
  beforeEach(() => {
    clearPreservedQuery(PRESERVED_QUERY_NAMESPACES.INVITE)
  })

  test('routes to signup when the invite is in the live query', () => {
    const query: LocationQuery = { invite: 'tok-123' }
    expect(resolveUnauthenticatedRedirectName(query)).toBe('cloud-signup')
  })

  test('routes to login when no invite is present anywhere', () => {
    expect(resolveUnauthenticatedRedirectName({})).toBe('cloud-login')
  })

  test('routes to signup from the preserved-query stash when the url has dropped the param', () => {
    stashInvite('tok-stashed')

    expect(
      resolveUnauthenticatedRedirectName({}),
      'a later navigation hop no longer carries ?invite= in the url, so the stash is the source of truth that keeps the invitee on the signup path'
    ).toBe('cloud-signup')
    // Sanity: the stash really is the thing being read here.
    expect(
      getPreservedQueryParam(PRESERVED_QUERY_NAMESPACES.INVITE, 'invite')
    ).toBe('tok-stashed')
  })

  test('routes to signup when the invite param is repeated (array-valued)', () => {
    const query: LocationQuery = { invite: ['tok-a', 'tok-b'] }
    expect(resolveUnauthenticatedRedirectName(query)).toBe('cloud-signup')
  })

  test('routes to login when the invite param is empty and the stash is empty', () => {
    const query: LocationQuery = { invite: '' }
    expect(
      resolveUnauthenticatedRedirectName(query),
      'an empty ?invite= is not an invite in flight and must not divert a normal login'
    ).toBe('cloud-login')
  })
})
