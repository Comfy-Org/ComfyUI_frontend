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

  it('categorizes an AuthStoreError as an api rejection', () => {
    expect(categorizeBillingApiError(new AuthStoreError('rejected'))).toBe(
      'api_rejected'
    )
  })

  it('categorizes a bare TypeError (fetch connectivity failure) as network', () => {
    expect(categorizeBillingApiError(new TypeError('Failed to fetch'))).toBe(
      'network'
    )
  })

  it('falls back to unknown for an unclassifiable error', () => {
    expect(categorizeBillingApiError(new Error('something odd'))).toBe(
      'unknown'
    )
    expect(categorizeBillingApiError('boom')).toBe('unknown')
    expect(categorizeBillingApiError(undefined)).toBe('unknown')
  })
})
