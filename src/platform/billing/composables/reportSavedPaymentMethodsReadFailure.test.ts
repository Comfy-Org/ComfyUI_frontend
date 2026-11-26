import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, vi } from 'vitest'

import { reportSavedPaymentMethodsReadFailure } from '@/platform/billing/composables/reportSavedPaymentMethodsReadFailure'

vi.mock(import('@comfyorg/telemetry/reportError'))

describe('reportSavedPaymentMethodsReadFailure', () => {
  it.for(['NOT_AUTHENTICATED', 'SUPERSEDED'] as const)(
    'stays silent on %s, a session that ended or moved on under the read',
    (code) => {
      reportSavedPaymentMethodsReadFailure(code, 'read_failed')

      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it.for(['REQUEST_FAILED', 'ACCESS_DENIED', 'MALFORMED_RESPONSE'] as const)(
    'reports %s under the caller error type',
    (code) => {
      reportSavedPaymentMethodsReadFailure(code, 'read_failed')

      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        new Error(`Saved payment methods read failed: ${code}`),
        { errorType: 'read_failed', surface: 'billing' }
      )
    }
  )
})
