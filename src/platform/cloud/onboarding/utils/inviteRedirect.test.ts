import { beforeEach, describe, expect, test } from 'vitest'
import type { LocationQuery } from 'vue-router'

import { clearPreservedQuery } from '@/platform/navigation/preservedQueryManager'
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
    // clearPreservedQuery skips storage when its in-memory namespace is cold, so
    // wipe the raw key too or a stale stash leaks into the no-invite case.
    sessionStorage.removeItem(
      `Comfy.PreservedQuery.${PRESERVED_QUERY_NAMESPACES.INVITE}`
    )
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
  })

  test('routes to signup when the invite param is repeated (array-valued)', () => {
    const query: LocationQuery = { invite: ['tok-a', 'tok-b'] }
    expect(resolveUnauthenticatedRedirectName(query)).toBe('cloud-signup')
  })

  test('routes to signup when the first repeated invite value is empty', () => {
    const query: LocationQuery = { invite: ['', 'tok-123'] }
    expect(
      resolveUnauthenticatedRedirectName(query),
      'a real token in a later array slot is still an invite in flight'
    ).toBe('cloud-signup')
  })

  test('routes to login when the invite param is empty and the stash is empty', () => {
    const query: LocationQuery = { invite: '' }
    expect(
      resolveUnauthenticatedRedirectName(query),
      'an empty ?invite= is not an invite in flight and must not divert a normal login'
    ).toBe('cloud-login')
  })
})
