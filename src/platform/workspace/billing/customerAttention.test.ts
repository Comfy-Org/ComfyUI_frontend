import { describe, expect, it } from 'vitest'

import { needsCustomerAttention } from './customerAttention'

describe('needsCustomerAttention', () => {
  const processing = {
    status: 'pending',
    actionUrl: null,
    authenticationState: null
  } as const

  it.for([
    [
      'claims a hosted verification link',
      { actionUrl: 'https://verify.example' },
      true
    ],
    [
      'claims an in-page challenge',
      { authenticationState: 'requires_action' },
      true
    ],
    [
      'claims a retryable decline',
      { authenticationState: 'failed_retryable' },
      true
    ],
    [
      'claims an operation support must reconcile',
      { status: 'reconciliation_needed' },
      true
    ],
    ['leaves a merely processing operation alone', {}, false],
    ['leaves a settled operation alone', { status: 'succeeded' }, false]
  ] as const)('%s', ([, operation, expected]) => {
    expect(needsCustomerAttention({ ...processing, ...operation })).toBe(
      expected
    )
  })
})
