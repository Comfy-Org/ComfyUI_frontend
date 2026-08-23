import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assert, setAssertReporter } from '@/base/assert'
import { createAssertReporter } from '@/platform/telemetry/assertionReporter'
import { useToastStore } from '@/platform/updates/common/toastStore'

const mockIsNightly = { value: false }
const captureException = vi.fn()

vi.mock('@/platform/distribution/types', () => ({
  get isNightly() {
    return mockIsNightly.value
  }
}))

vi.mock('@sentry/vue', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  isEnabled: () => true
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    addError: vi.fn(),
    getInitConfiguration: () => undefined
  }
}))

describe('createAssertReporter', () => {
  beforeEach(() => {
    mockIsNightly.value = false
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    setAssertReporter(null)
  })

  it('carries an assertion failure from assert() through to the error sinks', () => {
    vi.stubEnv('DEV', false)
    setAssertReporter(createAssertReporter(createPinia()))

    assert(false, 'graph is corrupt', { workflowPath: 'a/b.json' })

    expect(captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '[Assertion failed]: graph is corrupt'
      }),
      expect.objectContaining({
        level: 'warning',
        tags: expect.objectContaining({ error_type: 'assertion_failure' }),
        extra: { workflowPath: 'a/b.json' }
      })
    )
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

    expect(captureException).toHaveBeenCalledOnce()
    expect(useToastStore(pinia).messagesToAdd).toEqual([
      expect.objectContaining({
        severity: 'warn',
        detail: '[Assertion failed]: loud'
      })
    ])
  })
})
