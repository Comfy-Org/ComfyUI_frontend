import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('./reportError', () => ({
  reportError: mockReportError
}))

async function loadReporter() {
  vi.resetModules()
  return (await import('./assertFailureReporter')).reportAssertFailure
}

describe('reportAssertFailure', () => {
  beforeEach(() => {
    mockReportError.mockClear()
  })

  it('reports an assertion failure with its stack and context', async () => {
    const reportAssertFailure = await loadReporter()
    const failure = new Error('[Assertion failed]: graph must exist')

    reportAssertFailure(failure, { workflowPath: 'a/b.json' })

    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(failure, {
      errorType: 'assertion_failure',
      level: 'warning',
      context: { workflowPath: 'a/b.json' }
    })
  })

  it('deduplicates repeats so a render-loop invariant reports once', async () => {
    const reportAssertFailure = await loadReporter()

    reportAssertFailure(new Error('same message'))
    reportAssertFailure(new Error('same message'))
    reportAssertFailure(new Error('same message'))

    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('caps distinct reports per session', async () => {
    const reportAssertFailure = await loadReporter()

    for (let i = 0; i < 25; i++) {
      reportAssertFailure(new Error(`message ${i}`))
    }

    expect(mockReportError).toHaveBeenCalledTimes(20)
  })
})
