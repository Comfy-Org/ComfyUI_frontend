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

    reportAssertFailure('[Assertion failed]: graph must exist', {
      graphId: 'root'
    })

    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: '[Assertion failed]: graph must exist'
      }),
      {
        errorType: 'invariant_assert',
        context: { graphId: 'root', occurrenceCount: 1 }
      }
    )
  })

  it('reports coarse recurrence thresholds without reporting every repeat', async () => {
    const reportAssertFailure = await loadReporter()

    for (let i = 0; i < 100; i++) {
      reportAssertFailure('same message')
    }

    expect(mockReportError).toHaveBeenCalledTimes(3)
    expect(
      mockReportError.mock.calls.map(([, options]) => options.context)
    ).toEqual([
      { occurrenceCount: 1 },
      { occurrenceCount: 10 },
      { occurrenceCount: 100 }
    ])
  })

  it('caps distinct reports per session', async () => {
    const reportAssertFailure = await loadReporter()

    for (let i = 0; i < 25; i++) reportAssertFailure(`message ${i}`)

    expect(mockReportError).toHaveBeenCalledTimes(20)
  })
})
