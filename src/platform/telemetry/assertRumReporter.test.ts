import { beforeEach, describe, expect, it, vi } from 'vitest'

const { reportedErrors, rumState } = vi.hoisted(() => ({
  reportedErrors: [] as { error: Error; context: unknown }[],
  rumState: { failuresRemaining: 0 }
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    addError: (error: Error, context: unknown) => {
      if (rumState.failuresRemaining > 0) {
        rumState.failuresRemaining--
        throw new Error('RUM unavailable')
      }
      reportedErrors.push({ error, context })
    }
  }
}))

async function loadReporter() {
  vi.resetModules()
  return import('./assertRumReporter')
}

describe('reportAssertFailureToRum', () => {
  beforeEach(() => {
    reportedErrors.length = 0
    rumState.failuresRemaining = 0
  })

  it('reports each distinct message to RUM exactly once', async () => {
    const { reportAssertFailureToRum } = await loadReporter()

    reportAssertFailureToRum('[Assertion failed]: node missing')
    reportAssertFailureToRum('[Assertion failed]: node missing')
    reportAssertFailureToRum('[Assertion failed]: widget missing')

    await vi.waitFor(() => expect(reportedErrors).toHaveLength(2))
    expect(reportedErrors.map(({ error }) => error.message)).toEqual([
      '[Assertion failed]: node missing',
      '[Assertion failed]: widget missing'
    ])
    expect(reportedErrors[0].context).toEqual({ source: 'invariant-assert' })
  })

  it('stops reporting once the per-session cap is reached', async () => {
    const { reportAssertFailureToRum } = await loadReporter()

    for (let i = 0; i < 25; i++) {
      reportAssertFailureToRum(`[Assertion failed]: failure ${i}`)
    }

    await vi.waitFor(() => expect(reportedErrors).toHaveLength(20))
    expect(reportedErrors.at(-1)?.error.message).toBe(
      '[Assertion failed]: failure 19'
    )
  })

  it('retries a message whose send failed instead of consuming its cap slot', async () => {
    const { reportAssertFailureToRum } = await loadReporter()
    const message = '[Assertion failed]: transient send failure'
    rumState.failuresRemaining = 1

    reportAssertFailureToRum(message)

    await vi.waitFor(() => {
      reportAssertFailureToRum(message)
      expect(reportedErrors).toHaveLength(1)
    })
    expect(reportedErrors[0].error.message).toBe(message)
  })

  it('builds the error synchronously so the stack holds the call site', async () => {
    const { reportAssertFailureToRum } = await loadReporter()

    function assertingCallSite() {
      reportAssertFailureToRum('[Assertion failed]: stack check')
    }
    assertingCallSite()

    await vi.waitFor(() => expect(reportedErrors).toHaveLength(1))
    expect(reportedErrors[0].error.stack).toContain('assertingCallSite')
  })
})
