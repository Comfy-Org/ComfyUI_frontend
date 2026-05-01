import { describe, expect, test } from 'vitest'
import type { LocationQuery } from 'vue-router'

import { buildCloudLoginRedirectQuery } from './attributionRedirectQuery'

describe('buildCloudLoginRedirectQuery', () => {
  test('preserves attribution as top-level login query params', () => {
    const query: LocationQuery = {
      utm_source: 'google',
      utm_medium: 'cpc',
      gclid: 'abc123',
      ignored: 'value'
    }

    expect(
      buildCloudLoginRedirectQuery(
        '/?utm_source=google&utm_medium=cpc&gclid=abc123&ignored=value',
        query
      )
    ).toEqual({
      previousFullPath: encodeURIComponent(
        '/?utm_source=google&utm_medium=cpc&gclid=abc123&ignored=value'
      ),
      utm_source: 'google',
      utm_medium: 'cpc',
      gclid: 'abc123'
    })
  })

  test('keeps previousFullPath when no attribution is present', () => {
    expect(buildCloudLoginRedirectQuery('/cloud/pricing', {})).toEqual({
      previousFullPath: encodeURIComponent('/cloud/pricing')
    })
  })

  test('does not add login query for bare root path', () => {
    expect(buildCloudLoginRedirectQuery('/', {})).toBeUndefined()
  })
})
