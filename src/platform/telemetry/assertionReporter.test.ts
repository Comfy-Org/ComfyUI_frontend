import { createPinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { assert, setAssertReporter } from '@/base/assert'
import { createAssertReporter } from '@/platform/telemetry/assertionReporter'
import { useToastStore } from '@/platform/updates/common/toastStore'

const mockIsNightly = { value: false }
const mockRumConfig: { value: object | undefined } = { value: undefined }
const captureException = vi.fn()
const addError = vi.fn()

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
    addError: (...args: unknown[]) => addError(...args),
    getInitConfiguration: () => mockRumConfig.value
  }
}))

describe('createAssertReporter', () => {
  beforeEach(() => {
    mockIsNightly.value = false
    mockRumConfig.value = undefined
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

  it('reaches Datadog too, which is the sink the console echo is dropped for', () => {
    mockRumConfig.value = {}
    vi.stubEnv('DEV', false)
    setAssertReporter(createAssertReporter(createPinia()))

    assert(false, 'graph is corrupt', { workflowPath: 'a/b.json' })

    expect(addError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '[Assertion failed]: graph is corrupt'
      }),
      expect.objectContaining({
        error_type: 'assertion_failure',
        workflowPath: 'a/b.json'
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
        summary: 'Assertion failed',
        detail: '[Assertion failed]: loud'
      })
    ])
  })
})
