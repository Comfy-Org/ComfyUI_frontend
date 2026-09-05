import { beforeEach, describe, expect, it, vi } from 'vitest'

const captureException = vi.fn()
const isEnabled = vi.fn()
const addError = vi.fn()
const getInitConfiguration = vi.fn()
const captureDesktopException = vi.fn()

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
    delete window.__comfyDesktop2
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

  it('sends only sanctioned fields through the Desktop error bridge', async () => {
    sentryLive(false)
    datadogLive(false)
    window.__comfyDesktop2 = {
      Telemetry: {
        capture: vi.fn(),
        captureException: captureDesktopException
      }
    } as typeof window.__comfyDesktop2
    const { reportError } = await loadReportError()
    const error = new Error('failed for /Users/private/workflow.json')

    reportError(error, {
      errorType: 'workspace_auth_gate_initialization_failure',
      tags: { feature_area: 'workspace_auth', http_status: undefined },
      context: { workflow: '/Users/private/workflow.json' },
      level: 'error'
    })

    expect(captureDesktopException).toHaveBeenCalledWith(
      { message: error.message, stack: error.stack },
      {
        error_type: 'workspace_auth_gate_initialization_failure',
        feature_area: 'workspace_auth',
        level: 'error'
      }
    )
  })

  it('flushes an early report once Desktop is the only live sink', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })

    window.__comfyDesktop2 = {
      Telemetry: {
        capture: vi.fn(),
        captureException: captureDesktopException
      }
    } as typeof window.__comfyDesktop2
    flushErrorReports()

    expect(captureDesktopException).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'early' }),
      { error_type: 'resource_load_error' }
    )
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

  it('does not throw when a sink throws', async () => {
    captureException.mockImplementation(() => {
      throw new Error('sentry exploded')
    })
    const { reportError } = await loadReportError()

    expect(() =>
      reportError(new Error('boom'), {
        errorType: 'bootstrap_auth_wait_timeout'
      })
    ).not.toThrow()
  })
})
