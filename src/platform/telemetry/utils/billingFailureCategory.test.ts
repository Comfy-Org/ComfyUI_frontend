import { describe, expect, it } from 'vitest'

import { WorkspaceApiError } from '@/platform/workspace/api/workspaceApi'
import { AuthStoreError } from '@/stores/authStore'

import { categorizeBillingApiError } from './billingFailureCategory'

describe('categorizeBillingApiError', () => {
  it('categorizes a WorkspaceApiError with no status as a network failure', () => {
    expect(categorizeBillingApiError(new WorkspaceApiError('offline'))).toBe(
      'network'
    )
  })

  it('categorizes a WorkspaceApiError with an HTTP status as an api rejection', () => {
    expect(
      categorizeBillingApiError(new WorkspaceApiError('rejected', 400))
    ).toBe('api_rejected')
    expect(
      categorizeBillingApiError(new WorkspaceApiError('server error', 500))
    ).toBe('api_rejected')
  })

  it('categorizes an AuthStoreError with no status as a network failure', () => {
    expect(categorizeBillingApiError(new AuthStoreError('offline'))).toBe(
      'network'
    )
  })

  it('categorizes an AuthStoreError with an HTTP status as an api rejection', () => {
    expect(categorizeBillingApiError(new AuthStoreError('rejected', 400))).toBe(
      'api_rejected'
    )
    expect(
      categorizeBillingApiError(new AuthStoreError('server error', 500))
    ).toBe('api_rejected')
  })

  it('categorizes a bare TypeError (fetch connectivity failure) as network', () => {
    expect(categorizeBillingApiError(new TypeError('Failed to fetch'))).toBe(
      'network'
    )
    expect(categorizeBillingApiError(new TypeError('NetworkError'))).toBe(
      'network'
    )
    expect(categorizeBillingApiError(new TypeError('Load failed'))).toBe(
      'network'
    )
  })

  it('does not mislabel a non-connectivity TypeError as network', () => {
    expect(
      categorizeBillingApiError(new TypeError('x is not a function'))
    ).toBe('unknown')
  })

  it('falls back to unknown for an unclassifiable error', () => {
    expect(categorizeBillingApiError(new Error('something odd'))).toBe(
      'unknown'
    )
    expect(categorizeBillingApiError('boom')).toBe('unknown')
    expect(categorizeBillingApiError(undefined)).toBe('unknown')
  })
})
