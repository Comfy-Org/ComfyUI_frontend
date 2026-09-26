import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { TelemetryDispatcher } from '@/platform/telemetry/types'

const captureException = vi.fn()
const isEnabled = vi.fn()
const addError = vi.fn()
const getInitConfiguration = vi.fn()
const mockIsCloud = { value: false }
const captureDesktopException = vi.fn()
const hostTelemetryEnabled = vi.fn(() => true)
const trackClientErrorReported = vi.fn()
const telemetryRegistry = {
  value: null as TelemetryDispatcher | null
}

vi.mock(import('@/platform/telemetry'), () => ({
  useTelemetry: () => telemetryRegistry.value,
  setTelemetryRegistry: vi.fn()
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock(import('@/platform/telemetry/hostTelemetryEnabled'), () => ({
  isHostTelemetryEnabled: () => hostTelemetryEnabled()
}))

vi.mock(import('@sentry/vue'), () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  isEnabled: () => isEnabled()
}))

vi.mock<unknown>(import('@datadog/browser-rum'), () => ({
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

function installDesktopBridge(capture: unknown = captureDesktopException) {
  const telemetry = { capture: vi.fn() }
  Object.defineProperty(telemetry, 'captureException', { value: capture })
  window.__comfyDesktop2 = { Telemetry: telemetry }
}

describe('reportError', () => {
  beforeEach(() => {
    mockIsCloud.value = false
    delete window.__comfyDesktop2
    hostTelemetryEnabled.mockReturnValue(true)
    trackClientErrorReported.mockReset()
    telemetryRegistry.value = {
      trackClientErrorReported
    } as unknown as TelemetryDispatcher
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
      expect.objectContaining({
        name: 'workspace_auth_gate_initialization_failure',
        message: error.message
      }),
      expect.objectContaining({
        error_type: 'workspace_auth_gate_initialization_failure'
      })
    )
  })

  it('names a Datadog copy without changing the original error', async () => {
    const { reportError } = await loadReportError()
    const cause = new Error('Connection closed')
    const error = Object.freeze(
      Object.assign(
        new TypeError('Failed to fetch /assets/app-123.js', { cause }),
        {
          dd_fingerprint: 'asset_load',
          dd_context: { asset: '/assets/app-123.js' }
        }
      )
    )

    reportError(error, { errorType: 'resource_load_error' })

    const [datadogError] = addError.mock.calls[0]
    expect(datadogError).toBeInstanceOf(Error)
    expect(datadogError).not.toBe(error)
    expect(datadogError).toMatchObject({
      name: 'resource_load_error',
      message: error.message,
      stack: error.stack,
      cause,
      dd_fingerprint: error.dd_fingerprint,
      dd_context: error.dd_context
    })
    expect(captureException.mock.calls[0][0]).toBe(error)
    expect(error.name).toBe('TypeError')
  })

  it('still reports to Datadog when Sentry is inert', async () => {
    sentryLive(false)
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), { errorType: 'bootstrap_auth_wait_timeout' })

    expect(captureException).not.toHaveBeenCalled()
    expect(addError).toHaveBeenCalledOnce()
  })

  // The bridge gets the same message and stack Sentry does; what it never gets
  // is the free-form `context`, or a tag that is not a defined primitive.
  it('keeps context and non-primitive tags out of the Desktop payload', async () => {
    sentryLive(false)
    datadogLive(false)
    installDesktopBridge()
    const { reportError } = await loadReportError()
    const error = new Error('failed for /Users/private/workflow.json')
    const tags = {
      feature_area: 'workspace_auth',
      http_status: undefined
    }
    Object.assign(tags, { unsafe: { nested: true } })

    reportError(error, {
      errorType: 'workspace_auth_gate_initialization_failure',
      tags,
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

  it('flushes a report buffered before the Desktop bridge appeared', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })
    expect(captureDesktopException).not.toHaveBeenCalled()

    installDesktopBridge()
    flushErrorReports()
    flushErrorReports()

    expect(captureDesktopException).toHaveBeenCalledOnce()
  })

  it('retires a report off cloud once the Desktop bridge accepted it', async () => {
    sentryLive(false)
    datadogLive(false)
    installDesktopBridge()
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })
    expect(captureDesktopException).toHaveBeenCalledOnce()

    datadogLive(true)
    flushErrorReports()

    expect(addError).not.toHaveBeenCalled()
  })

  it('buffers for another sink when an older Desktop bridge omits captureException', async () => {
    sentryLive(false)
    datadogLive(false)
    window.__comfyDesktop2 = { Telemetry: { capture: vi.fn() } }
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })
    datadogLive(true)
    flushErrorReports()

    expect(addError).toHaveBeenCalledOnce()
  })

  it('honors the host telemetry kill switch', async () => {
    sentryLive(false)
    datadogLive(false)
    hostTelemetryEnabled.mockReturnValue(false)
    installDesktopBridge()
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('disabled'), { errorType: 'resource_load_error' })
    expect(captureDesktopException).not.toHaveBeenCalled()

    hostTelemetryEnabled.mockReturnValue(true)
    flushErrorReports()
    expect(captureDesktopException).toHaveBeenCalledOnce()
  })

  it('ignores a non-callable Desktop captureException', async () => {
    sentryLive(false)
    datadogLive(false)
    installDesktopBridge('not a function')
    const { reportError, flushErrorReports } = await loadReportError()

    expect(() =>
      reportError(new Error('early'), { errorType: 'resource_load_error' })
    ).not.toThrow()

    datadogLive(true)
    flushErrorReports()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('keeps a buffered report deliverable when the Desktop bridge is not an object', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })

    Object.defineProperty(window, '__comfyDesktop2', {
      value: { Telemetry: 'invalid' },
      configurable: true
    })
    expect(() => flushErrorReports()).not.toThrow()

    datadogLive(true)
    flushErrorReports()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('does not throw out of flushErrorReports when the sink probe throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })
    hostTelemetryEnabled.mockImplementation(() => {
      throw new Error('storage is blocked')
    })

    expect(() => flushErrorReports()).not.toThrow()

    hostTelemetryEnabled.mockReturnValue(true)
    datadogLive(true)
    flushErrorReports()
    expect(addError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
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
      expect.objectContaining({
        name: 'resource_load_error',
        message: 'early'
      }),
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
      expect.objectContaining({
        name: 'bootstrap_auth_wait_timeout',
        message: 'just a string'
      }),
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

  it('drops undefined context values from both sinks', async () => {
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), {
      errorType: 'http_error',
      context: {
        requestId: 'abc123',
        retryAfter: undefined,
        attempts: 0,
        lastMessage: '',
        healthy: false,
        cause: null
      }
    })

    const [, datadogContext] = addError.mock.calls[0]
    expect(datadogContext).not.toHaveProperty('retryAfter')
    expect(datadogContext).toMatchObject({
      requestId: 'abc123',
      attempts: 0,
      lastMessage: '',
      healthy: false,
      cause: null
    })

    const [, sentryOptions] = captureException.mock.calls[0]
    expect(sentryOptions.extra).not.toHaveProperty('retryAfter')
    expect(sentryOptions.extra).toMatchObject({
      requestId: 'abc123',
      attempts: 0,
      lastMessage: '',
      healthy: false,
      cause: null
    })
  })

  it('keeps a caller tag out of the reserved level field', async () => {
    sentryLive(false)
    datadogLive(false)
    installDesktopBridge()
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), {
      errorType: 'http_error',
      tags: { level: 'warning', error_type: 'spoofed' }
    })

    const [, properties] = captureDesktopException.mock.calls[0]
    expect(properties).toEqual({ error_type: 'http_error' })
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

  it('writes the failure to the console so callers need no second sink', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { reportError, REPORTED_ERROR_PREFIX } = await loadReportError()
    const error = new Error('listener failed')

    reportError(error, { errorType: 'canvas_layout_listener_failed' })

    expect(consoleError).toHaveBeenCalledExactlyOnceWith(
      `${REPORTED_ERROR_PREFIX}canvas_layout_listener_failed`,
      error
    )
  })

  it('logs a warning-level report through console.warn', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { reportError, REPORTED_ERROR_PREFIX } = await loadReportError()

    reportError(new Error('cookie denied'), {
      errorType: 'session_cookie_creation_failure',
      level: 'warning'
    })

    expect(consoleWarn).toHaveBeenCalledWith(
      `${REPORTED_ERROR_PREFIX}session_cookie_creation_failure`,
      expect.any(Error)
    )
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('skips the console line for a caller that already logged', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { reportError } = await loadReportError()

    reportError(new Error('[Assertion failed]: graph must exist'), {
      errorType: 'invariant_assert',
      logToConsole: false
    })

    expect(consoleError).not.toHaveBeenCalled()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('logs a buffered report once, when it is raised', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), { errorType: 'resource_load_error' })
    datadogLive(true)
    flushErrorReports()

    expect(consoleError).toHaveBeenCalledOnce()
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

  it('delivers a report that re-enters through a sink once, then accepts the next report', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { reportError } = await loadReportError()
    const nested = new Error('Graph serialization state mismatch')
    captureException.mockImplementationOnce(() => {
      reportError(nested, { errorType: 'graph_serialization_state_mismatch' })
    })

    reportError(new Error('bad subgraph'), {
      errorType: 'subgraph_load_failure'
    })

    expect(captureException).toHaveBeenCalledOnce()
    expect(addError).toHaveBeenCalledOnce()
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('graph_serialization_state_mismatch'),
      nested
    )

    reportError(new Error('later'), { errorType: 'http_error' })

    expect(captureException).toHaveBeenCalledTimes(2)
    expect(addError).toHaveBeenCalledTimes(2)
  })

  it('counts an allowlisted failure in product analytics as well as Sentry', async () => {
    const { reportError } = await loadReportError()
    const error = Object.assign(
      new Error('Global setting request failed: 500'),
      { status: 500 }
    )

    reportError(error, { errorType: 'agent_consent_setting_load_failure' })

    expect(captureException).toHaveBeenCalledOnce()
    expect(trackClientErrorReported).toHaveBeenCalledExactlyOnceWith({
      error_type: 'agent_consent_setting_load_failure',
      failure_kind: 'server_error',
      level: 'error',
      http_status: 500
    })
  })

  // The counter is a second sink, not a replacement: Sentry still gets the
  // error for every slug, allowlisted or not.
  it('leaves an unlisted failure out of product analytics without changing its report', async () => {
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), {
      errorType: 'graph_serialization_state_mismatch'
    })

    expect(captureException).toHaveBeenCalledOnce()
    expect(addError).toHaveBeenCalledOnce()
    expect(trackClientErrorReported).not.toHaveBeenCalled()
  })

  it('counts a buffered report once, when it is raised, not again when it drains', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), {
      errorType: 'agent_consent_setting_load_failure'
    })
    expect(trackClientErrorReported).toHaveBeenCalledOnce()

    datadogLive(true)
    flushErrorReports()
    flushErrorReports()

    expect(addError).toHaveBeenCalledOnce()
    expect(trackClientErrorReported).toHaveBeenCalledOnce()
  })

  it('still reports the error when the analytics counter throws', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    trackClientErrorReported.mockImplementation(() => {
      throw new Error('posthog exploded')
    })
    const { reportError } = await loadReportError()

    expect(() =>
      reportError(new Error('boom'), {
        errorType: 'agent_consent_setting_load_failure'
      })
    ).not.toThrow()
    expect(captureException).toHaveBeenCalledOnce()
    expect(addError).toHaveBeenCalledOnce()
    consoleError.mockRestore()
  })

  it('reports normally when no telemetry registry is up yet', async () => {
    telemetryRegistry.value = null
    const { reportError } = await loadReportError()

    reportError(new Error('early'), {
      errorType: 'agent_consent_setting_load_failure'
    })

    expect(captureException).toHaveBeenCalledOnce()
  })

  it('does not count a report suppressed for re-entrancy', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { reportError } = await loadReportError()
    captureException.mockImplementationOnce(() => {
      reportError(new Error('nested'), {
        errorType: 'agent_consent_setting_load_failure'
      })
    })

    reportError(new Error('outer'), { errorType: 'subgraph_load_failure' })

    expect(trackClientErrorReported).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('skips the console line for a suppressed re-entrant report that opted out', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { reportError } = await loadReportError()
    captureException.mockImplementationOnce(() => {
      reportError(new Error('nested'), {
        errorType: 'invariant_assert',
        logToConsole: false
      })
    })

    reportError(new Error('outer'), {
      errorType: 'subgraph_load_failure',
      logToConsole: false
    })

    expect(consoleError).not.toHaveBeenCalled()
    expect(consoleWarn).not.toHaveBeenCalled()
  })

  it('logs a suppressed warning-level re-entrant report through console.warn', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { reportError, REPORTED_ERROR_PREFIX } = await loadReportError()
    const nested = new Error('nested')
    captureException.mockImplementationOnce(() => {
      reportError(nested, {
        errorType: 'session_cookie_creation_failure',
        level: 'warning'
      })
    })

    reportError(new Error('outer'), {
      errorType: 'subgraph_load_failure',
      logToConsole: false
    })

    expect(consoleWarn).toHaveBeenCalledExactlyOnceWith(
      `${REPORTED_ERROR_PREFIX}session_cookie_creation_failure (suppressed: raised while reporting)`,
      nested
    )
    expect(consoleError).not.toHaveBeenCalled()
  })
})
