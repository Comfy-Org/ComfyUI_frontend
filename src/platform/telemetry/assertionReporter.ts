import type { Pinia } from 'pinia'

import type { AssertReporter } from '@/base/assert'
import { isNightly } from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useToastStore } from '@/platform/updates/common/toastStore'

/**
 * Sends every assertion failure to the observability sinks, and surfaces it
 * in-app on nightly builds.
 *
 * The toast strings are intentionally not i18n'd: they are developer/nightly
 * diagnostics, not user-facing copy in stable releases.
 */
export function createAssertReporter(pinia: Pinia): AssertReporter {
  return (failure, context) => {
    reportError(failure, {
      errorType: 'assertion_failure',
      level: 'warning',
      context
    })

    if (isNightly) {
      useToastStore(pinia).add({
        severity: 'warn',
        summary: 'Assertion failed',
        detail: failure.message
      })
    }
  }
}
