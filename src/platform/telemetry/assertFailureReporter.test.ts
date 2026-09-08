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

  it('reports an assertion failure as an invariant error', async () => {
    const reportAssertFailure = await loadReporter()

    reportAssertFailure('[Assertion failed]: graph must exist')

    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: '[Assertion failed]: graph must exist'
      }),
      { errorType: 'invariant_assert' }
    )
  })

  it('deduplicates repeats so a render-loop invariant reports once', async () => {
    const reportAssertFailure = await loadReporter()

    reportAssertFailure('same message')
    reportAssertFailure('same message')
    reportAssertFailure('same message')

    expect(mockReportError).toHaveBeenCalledOnce()
  })

  it('caps distinct reports per session', async () => {
    const reportAssertFailure = await loadReporter()

    for (let i = 0; i < 25; i++) reportAssertFailure(`message ${i}`)

    expect(mockReportError).toHaveBeenCalledTimes(20)
  })
})
