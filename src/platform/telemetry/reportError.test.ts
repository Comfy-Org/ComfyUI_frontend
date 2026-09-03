import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureException = vi.fn()
const isEnabled = vi.fn()
const addError = vi.fn()
const getInitConfiguration = vi.fn()
const mockIsCloud = { value: false }

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock('@sentry/vue', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  isEnabled: () => isEnabled()
}))

vi.mock('@datadog/browser-rum', () => ({
  datadogRum: {
    addError: (...args: unknown[]) => addError(...args),
    getInitConfiguration: () => getInitConfiguration()
  }
}))

async function loadReportError() {
  vi.resetModules()
  return import('./reportError')
}

const sentryLive = (live: boolean) => isEnabled.mockReturnValue(live)
const datadogLive = (live: boolean) =>
  getInitConfiguration.mockReturnValue(live ? {} : undefined)

describe('reportError', () => {
  beforeEach(() => {
    mockIsCloud.value = false
    sentryLive(true)
    datadogLive(true)
  })

  it('reaches both Sentry and Datadog from a single call', async () => {
    const { reportError } = await loadReportError()
    const error = new Error('boom')

    reportError(error, {
      errorType: 'workspace_auth_gate_initialization_failure'
    })

    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          error_type: 'workspace_auth_gate_initialization_failure'
        })
      })
    )
    expect(addError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        error_type: 'workspace_auth_gate_initialization_failure'
      })
    )
  })

  it('still reports to Datadog when Sentry is inert', async () => {
    sentryLive(false)
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), { errorType: 'bootstrap_auth_wait_timeout' })

    expect(captureException).not.toHaveBeenCalled()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('buffers reports raised before any sink is live, then flushes them', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })
    expect(addError).not.toHaveBeenCalled()

    datadogLive(true)
    flushErrorReports()

    expect(addError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'early' }),
      expect.objectContaining({ error_type: 'resource_load_error' })
    )
  })

  it('does not replay a buffered report twice', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })

    datadogLive(true)
    flushErrorReports()
    flushErrorReports()

    expect(addError).toHaveBeenCalledOnce()
  })

  it('retains the Datadog delivery when Sentry starts first on cloud', async () => {
    mockIsCloud.value = true
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()
    const error = new Error('early assertion')

    reportError(error, { errorType: 'invariant_assert' })
    flushErrorReports()

    expect(captureException).toHaveBeenCalledOnce()
    expect(addError).not.toHaveBeenCalled()

    datadogLive(true)
    flushErrorReports()
    flushErrorReports()

    expect(captureException).toHaveBeenCalledOnce()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('bounds the buffer so a boot-time error storm cannot grow without limit', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    for (let i = 0; i < 200; i++) {
      reportError(new Error(`e${i}`), { errorType: 'resource_load_error' })
    }

    datadogLive(true)
    flushErrorReports()

    expect(addError.mock.calls.length).toBeLessThanOrEqual(25)
  })

  it('normalizes a non-Error cause', async () => {
    const { reportError } = await loadReportError()

    reportError('just a string', { errorType: 'bootstrap_auth_wait_timeout' })

    expect(addError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'just a string' }),
      expect.anything()
    )
  })

  it('drops undefined tag values rather than forwarding them', async () => {
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), {
      errorType: 'http_error',
      tags: { api_endpoint: '/settings/{key}', http_status: undefined }
    })

    const [, context] = addError.mock.calls[0]
    expect(context).not.toHaveProperty('http_status')
    expect(context).toMatchObject({ api_endpoint: '/settings/{key}' })
  })

  it('does not throw out of flushErrorReports when a sink throws', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })

    datadogLive(true)
    addError.mockImplementation(() => {
      throw new Error('datadog exploded')
    })

    expect(() => flushErrorReports()).not.toThrow()
  })

  it('does not resend to Sentry when a buffered Datadog delivery fails', async () => {
    mockIsCloud.value = true
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('cold boot'), { errorType: 'invariant_assert' })

    sentryLive(true)
    datadogLive(true)
    addError.mockImplementationOnce(() => {
      throw new Error('datadog exploded')
    })
    flushErrorReports()
    flushErrorReports()

    expect(captureException).toHaveBeenCalledOnce()
    expect(addError).toHaveBeenCalledTimes(2)
  })

  it('retries only Sentry when its cloud delivery fails', async () => {
    mockIsCloud.value = true
    captureException.mockImplementationOnce(() => {
      throw new Error('sentry exploded')
    })
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('boom'), { errorType: 'invariant_assert' })
    flushErrorReports()

    expect(captureException).toHaveBeenCalledTimes(2)
    expect(addError).toHaveBeenCalledOnce()
  })

  it('still reports to Datadog when Sentry throws', async () => {
    captureException.mockImplementation(() => {
      throw new Error('sentry exploded')
    })
    const { reportError } = await loadReportError()

    expect(() =>
      reportError(new Error('boom'), {
        errorType: 'bootstrap_auth_wait_timeout'
      })
    ).not.toThrow()
    expect(addError).toHaveBeenCalledOnce()
  })
})
