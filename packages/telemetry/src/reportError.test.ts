import type { DatadogRum } from '@datadog/browser-rum'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { REPORTED_ERROR_PREFIX } from '@comfyorg/shared-frontend-utils/telemetry'

import type { configureErrorReporter } from './reportError'

vi.unmock(import('@comfyorg/telemetry/reportError'))

const captureException = vi.fn()
const isEnabled = vi.fn()
const addError = vi.fn()
const getInitConfiguration = vi.fn()
const mockIsCloud = { value: false }
const mockFrontendBucket = {
  value: undefined as 'canary' | 'stable' | undefined
}
const captureDesktopException = vi.fn()
const hostTelemetryEnabled = vi.fn(() => true)
let desktopTelemetry: unknown

vi.mock(import('@comfyorg/telemetry/rumContext'), () => ({
  getFrontendBucket: () => mockFrontendBucket.value,
  getDatadogRum: () =>
    fromPartial<DatadogRum>({
      addError: (...args: unknown[]) => addError(...args),
      getInitConfiguration: () => getInitConfiguration()
    })
}))

async function loadReportError() {
  vi.resetModules()
  const reporter = await import('./reportError')
  configureReporter(reporter.configureErrorReporter)
  return reporter
}

function configureReporter(configure: typeof configureErrorReporter) {
  configure({
    captureException,
    isSentryEnabled: isEnabled,
    isCloud: () => mockIsCloud.value,
    isHostTelemetryEnabled: hostTelemetryEnabled,
    getDesktopTelemetry: () => desktopTelemetry
  })
}

const sentryLive = (live: boolean) => isEnabled.mockReturnValue(live)
const datadogLive = (live: boolean) =>
  getInitConfiguration.mockReturnValue(live ? {} : undefined)

function installDesktopBridge(capture: unknown = captureDesktopException) {
  const telemetry = { capture: vi.fn() }
  Object.defineProperty(telemetry, 'captureException', { value: capture })
  desktopTelemetry = telemetry
}

describe('reportError', () => {
  beforeEach(() => {
    mockIsCloud.value = false
    mockFrontendBucket.value = undefined
    desktopTelemetry = undefined
    hostTelemetryEnabled.mockReturnValue(true)
    sentryLive(true)
    datadogLive(true)
  })

  it('retains early reports until the app configures its sinks', async () => {
    vi.resetModules()
    datadogLive(false)
    const { reportError, flushErrorReports, configureErrorReporter } =
      await import('@comfyorg/telemetry/reportError')
    const error = new Error('before telemetry setup')

    reportError(error, {
      surface: 'platform',
      errorType: 'failure_initializing_workspace_auth_gate'
    })

    expect(captureException).not.toHaveBeenCalled()

    configureReporter(configureErrorReporter)
    flushErrorReports()
    flushErrorReports()

    expect(captureException).toHaveBeenCalledExactlyOnceWith(
      error,
      expect.objectContaining({
        tags: {
          error_type: 'failure_initializing_workspace_auth_gate',
          surface: 'platform'
        }
      })
    )
  })

  it('tags Sentry and Datadog with the resolved canary bucket', async () => {
    mockFrontendBucket.value = 'canary'
    installDesktopBridge()
    const { reportError } = await loadReportError()
    const error = new Error('boom')

    reportError(error, {
      surface: 'platform',
      errorType: 'workspace_auth_gate_initialization_failure',
      fingerprint: ['workspace_auth_gate_initialization_failure']
    })

    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        fingerprint: ['workspace_auth_gate_initialization_failure'],
        tags: expect.objectContaining({ bucket: 'canary' })
      })
    )
    expect(addError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bucket: 'canary' })
    )
    expect(captureDesktopException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bucket: 'canary' })
    )
  })

  it('never lets a caller tag override the resolved bucket', async () => {
    mockFrontendBucket.value = 'canary'
    installDesktopBridge()
    const { reportError } = await loadReportError()
    const error = new Error('boom')

    reportError(error, {
      surface: 'platform',
      errorType: 'workspace_auth_gate_initialization_failure',
      tags: { bucket: 'stable' }
    })

    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({ bucket: 'canary' })
      })
    )
    expect(captureDesktopException).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ bucket: 'canary' })
    )
  })

  it('omits the bucket tag before it resolves', async () => {
    const { reportError } = await loadReportError()
    const error = new Error('boom')

    reportError(error, {
      surface: 'platform',
      errorType: 'workspace_auth_gate_initialization_failure'
    })

    const [, sentryOptions] = captureException.mock.calls[0] as [
      unknown,
      { tags: Record<string, unknown> }
    ]
    expect(sentryOptions.tags).not.toHaveProperty('bucket')
  })

  it('reaches both Sentry and Datadog from a single call', async () => {
    const { reportError } = await loadReportError()
    const error = new Error('boom')

    reportError(error, {
      surface: 'platform',
      errorType: 'workspace_auth_gate_initialization_failure'
    })

    expect(captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        tags: expect.objectContaining({
          error_type: 'workspace_auth_gate_initialization_failure',
          surface: 'platform'
        })
      })
    )
    expect(addError).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'workspace_auth_gate_initialization_failure',
        message: error.message
      }),
      expect.objectContaining({
        error_type: 'workspace_auth_gate_initialization_failure',
        surface: 'platform'
      })
    )
  })

  it('does not report an error again after its complete diagnostic was emitted', async () => {
    const { markErrorReported, reportError } = await loadReportError()
    const error = new Error('backend-controlled message')
    markErrorReported(error)

    reportError(error, {
      surface: 'agent',
      errorType: 'duplicate_agent_failure'
    })

    expect(captureException).not.toHaveBeenCalled()
    expect(addError).not.toHaveBeenCalled()
  })

  it('overrides Sentry grouping only when a fingerprint is given', async () => {
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), {
      surface: 'agent',
      errorType: 'agent_thread_list_load_failed',
      fingerprint: ['agent-request-failure', '/agent/threads']
    })
    reportError(new Error('boom'), {
      surface: 'agent',
      errorType: 'agent_thread_list_load_failed'
    })

    expect(captureException.mock.calls[0][1]).toMatchObject({
      fingerprint: ['agent-request-failure', '/agent/threads']
    })
    expect(captureException.mock.calls[1][1]).not.toHaveProperty('fingerprint')
  })

  it('does not send a fingerprint to Datadog, which groups on errorType', async () => {
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), {
      surface: 'agent',
      errorType: 'agent_history_load_failed',
      fingerprint: ['agent-request-failure']
    })

    expect(addError.mock.calls[0][1]).not.toHaveProperty('fingerprint')
  })

  it('names a Datadog copy without changing the original error', async () => {
    const { reportError } = await loadReportError()
    const cause = new Error(
      'Connection closed https://example.com/model.glb?token=private'
    )
    const error = Object.freeze(
      Object.assign(
        new TypeError('Failed to fetch /assets/app-123.js', { cause }),
        {
          dd_fingerprint: 'asset_load',
          dd_context: { asset: '/assets/app-123.js' }
        }
      )
    )

    reportError(error, {
      surface: 'platform',
      errorType: 'resource_load_error'
    })

    const [datadogError] = addError.mock.calls[0]
    expect(datadogError).toBeInstanceOf(Error)
    expect(datadogError).not.toBe(error)
    expect(datadogError).toMatchObject({
      name: 'resource_load_error',
      message: error.message,
      stack: error.stack,
      dd_fingerprint: error.dd_fingerprint,
      dd_context: error.dd_context
    })
    expect(datadogError.cause).toMatchObject({
      message: 'Connection closed https://example.com/model.glb'
    })
    expect(datadogError.cause).not.toBe(cause)
    expect(captureException.mock.calls[0][0]).toBe(error)
    expect(error.name).toBe('TypeError')
  })

  it('still reports to Datadog when Sentry is inert', async () => {
    sentryLive(false)
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), {
      surface: 'platform',
      errorType: 'bootstrap_auth_wait_timeout'
    })

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
      surface: 'platform',
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
        level: 'error',
        surface: 'platform'
      }
    )
  })

  it('flushes a report buffered before the Desktop bridge appeared', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })
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

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })
    expect(captureDesktopException).toHaveBeenCalledOnce()

    datadogLive(true)
    flushErrorReports()

    expect(addError).not.toHaveBeenCalled()
  })

  it('buffers for another sink when an older Desktop bridge omits captureException', async () => {
    sentryLive(false)
    datadogLive(false)
    desktopTelemetry = { capture: vi.fn() }
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })
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

    reportError(new Error('disabled'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })
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
      reportError(new Error('early'), {
        surface: 'platform',
        errorType: 'resource_load_error'
      })
    ).not.toThrow()

    datadogLive(true)
    flushErrorReports()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('keeps a buffered report deliverable when the Desktop bridge is not an object', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })

    desktopTelemetry = 'invalid'
    expect(() => flushErrorReports()).not.toThrow()

    datadogLive(true)
    flushErrorReports()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('does not throw out of flushErrorReports when the sink probe throws', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })
    hostTelemetryEnabled.mockImplementation(() => {
      throw new Error('storage is blocked')
    })

    expect(() => flushErrorReports()).not.toThrow()

    hostTelemetryEnabled.mockReturnValue(true)
    datadogLive(true)
    flushErrorReports()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('buffers reports raised before any sink is live, then flushes them', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })
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

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })

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

    reportError(error, {
      surface: 'platform',
      errorType: 'invariant_assert'
    })
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
      reportError(new Error(`e${i}`), {
        surface: 'platform',
        errorType: 'resource_load_error'
      })
    }

    datadogLive(true)
    flushErrorReports()

    expect(addError.mock.calls.length).toBeLessThanOrEqual(25)
  })

  it('normalizes a non-Error cause', async () => {
    const { reportError } = await loadReportError()

    reportError('just a string', {
      surface: 'platform',
      errorType: 'bootstrap_auth_wait_timeout'
    })

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
      surface: 'platform',
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
      surface: 'platform',
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

  it('keeps caller tags out of reserved fields', async () => {
    sentryLive(false)
    datadogLive(false)
    installDesktopBridge()
    const { reportError } = await loadReportError()

    reportError(new Error('boom'), {
      surface: 'platform',
      errorType: 'http_error',
      tags: {
        level: 'warning',
        error_type: 'spoofed',
        surface: 'spoofed'
      }
    })

    const [, properties] = captureDesktopException.mock.calls[0]
    expect(properties).toEqual({
      error_type: 'http_error',
      surface: 'platform'
    })
  })

  it('does not throw out of flushErrorReports when a sink throws', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })

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

    reportError(new Error('cold boot'), {
      surface: 'platform',
      errorType: 'invariant_assert'
    })

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

    reportError(new Error('boom'), {
      surface: 'platform',
      errorType: 'invariant_assert'
    })
    flushErrorReports()

    expect(captureException).toHaveBeenCalledTimes(2)
    expect(addError).toHaveBeenCalledOnce()
  })

  it('writes the failure to the console so callers need no second sink', async () => {
    const { reportError } = await loadReportError()
    const error = new Error('listener failed')

    reportError(error, {
      surface: 'platform',
      errorType: 'canvas_layout_listener_failed'
    })

    expect(console.error).toHaveBeenCalledExactlyOnceWith(
      `${REPORTED_ERROR_PREFIX}canvas_layout_listener_failed`,
      error
    )
  })

  it('logs a warning-level report through console.warn', async () => {
    const { reportError } = await loadReportError()

    reportError(new Error('cookie denied'), {
      surface: 'platform',
      errorType: 'session_cookie_creation_failure',
      level: 'warning'
    })

    expect(console.warn).toHaveBeenCalledWith(
      `${REPORTED_ERROR_PREFIX}session_cookie_creation_failure`,
      expect.any(Error)
    )
    expect(console.error).not.toHaveBeenCalled()
  })

  it('skips the console line for a caller that already logged', async () => {
    const { reportError } = await loadReportError()

    reportError(new Error('[Assertion failed]: graph must exist'), {
      surface: 'platform',
      errorType: 'invariant_assert',
      logToConsole: false
    })

    expect(console.error).not.toHaveBeenCalled()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('logs a buffered report once, when it is raised', async () => {
    sentryLive(false)
    datadogLive(false)
    const { reportError, flushErrorReports } = await loadReportError()

    reportError(new Error('early'), {
      surface: 'platform',
      errorType: 'resource_load_error'
    })
    datadogLive(true)
    flushErrorReports()

    expect(console.error).toHaveBeenCalledOnce()
  })

  it('still reports to Datadog when Sentry throws', async () => {
    captureException.mockImplementation(() => {
      throw new Error('sentry exploded')
    })
    const { reportError } = await loadReportError()

    expect(() =>
      reportError(new Error('boom'), {
        surface: 'platform',
        errorType: 'bootstrap_auth_wait_timeout'
      })
    ).not.toThrow()
    expect(addError).toHaveBeenCalledOnce()
  })

  it('delivers a report that re-enters through a sink once, then accepts the next report', async () => {
    const { reportError } = await loadReportError()
    const nested = new Error('Graph serialization state mismatch')
    captureException.mockImplementationOnce(() => {
      reportError(nested, {
        surface: 'platform',
        errorType: 'graph_serialization_state_mismatch'
      })
    })

    reportError(new Error('bad subgraph'), {
      surface: 'platform',
      errorType: 'subgraph_load_failure'
    })

    expect(captureException).toHaveBeenCalledOnce()
    expect(addError).toHaveBeenCalledOnce()
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('graph_serialization_state_mismatch'),
      nested
    )

    reportError(new Error('later'), {
      surface: 'platform',
      errorType: 'http_error'
    })

    expect(captureException).toHaveBeenCalledTimes(2)
    expect(addError).toHaveBeenCalledTimes(2)
  })

  it('skips the console line for a suppressed re-entrant report that opted out', async () => {
    const { reportError } = await loadReportError()
    captureException.mockImplementationOnce(() => {
      reportError(new Error('nested'), {
        surface: 'platform',
        errorType: 'invariant_assert',
        logToConsole: false
      })
    })

    reportError(new Error('outer'), {
      surface: 'platform',
      errorType: 'subgraph_load_failure',
      logToConsole: false
    })

    expect(console.error).not.toHaveBeenCalled()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('logs a suppressed warning-level re-entrant report through console.warn', async () => {
    const { reportError } = await loadReportError()
    const nested = new Error('nested')
    captureException.mockImplementationOnce(() => {
      reportError(nested, {
        surface: 'platform',
        errorType: 'session_cookie_creation_failure',
        level: 'warning'
      })
    })

    reportError(new Error('outer'), {
      surface: 'platform',
      errorType: 'subgraph_load_failure',
      logToConsole: false
    })

    expect(console.warn).toHaveBeenCalledExactlyOnceWith(
      `${REPORTED_ERROR_PREFIX}session_cookie_creation_failure (suppressed: raised while reporting)`,
      nested
    )
    expect(console.error).not.toHaveBeenCalled()
  })
})
