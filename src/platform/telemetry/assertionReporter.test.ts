import { createPinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createAssertReporter } from '@/platform/telemetry/assertionReporter'
import { useToastStore } from '@/platform/updates/common/toastStore'

const mockIsNightly = { value: false }
const reportError = vi.fn()

vi.mock('@/platform/distribution/types', () => ({
  get isNightly() {
    return mockIsNightly.value
  }
}))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: (...args: unknown[]) => reportError(...args)
}))

describe('createAssertReporter', () => {
  beforeEach(() => {
    mockIsNightly.value = false
  })

  it('reports every assertion failure through the shared error pipeline', () => {
    const failure = new Error('[Assertion failed]: graph is corrupt')

    createAssertReporter(createPinia())(failure)

    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'assertion_failure',
      level: 'warning'
    })
  })

  it('does not toast outside nightly builds', () => {
    const pinia = createPinia()

    createAssertReporter(pinia)(new Error('[Assertion failed]: quiet'))

    expect(useToastStore(pinia).messagesToAdd).toHaveLength(0)
  })

  it('also surfaces the failure as a toast on nightly builds', () => {
    mockIsNightly.value = true
    const pinia = createPinia()

    createAssertReporter(pinia)(new Error('[Assertion failed]: loud'))

    expect(reportError).toHaveBeenCalledOnce()
    expect(useToastStore(pinia).messagesToAdd).toEqual([
      expect.objectContaining({
        severity: 'warn',
        detail: '[Assertion failed]: loud'
      })
    ])
  })
})
