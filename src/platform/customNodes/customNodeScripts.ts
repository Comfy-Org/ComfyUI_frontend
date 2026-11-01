import type { CpuServerReading } from '@/platform/customNodes/lateLoading/cpuServerStep'
import {
  importNoticingFetchFailure,
  loadCustomNodesWithDeadline
} from '@/platform/customNodes/lateLoading/lateLoading'
import {
  CUSTOM_NODE_FAILURES_TRUNCATED_FIELD,
  CUSTOM_NODE_LOAD_ERROR_TYPE
} from '@/platform/telemetry/customNodeLoadTelemetry'
import type { CustomNodeFailureDiagnostic } from '@/platform/telemetry/customNodeLoadTelemetry'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'
import {
  getErrorMessage,
  toError
} from '@comfyorg/shared-frontend-utils/errorUtil'

const INLINED_CLOUD_EXTENSIONS = new Set([
  '/extensions/cloud/rum.js',
  '/extensions/cloud/sentry.js'
])

export function getExtensionPath(script: string): string | undefined {
  try {
    const pathname = new URL(script, window.location.href).pathname
    return pathname.match(/^\/extensions\/[^/]+\//)?.[0]
  } catch {
    return undefined
  }
}

export function isSafeExtensionBoot(search: string): boolean {
  const value = new URLSearchParams(search).get('safe')
  return value === '' || value === '1' || value === 'true'
}

let safeBootCaptured = false

/** Takes `?safe` out of the URL before the router reads it, so it covers this load only. */
export function captureSafeExtensionBoot(): void {
  const url = new URL(globalThis.location.href)
  if (!isSafeExtensionBoot(url.search)) return
  safeBootCaptured = true
  url.searchParams.delete('safe')
  globalThis.history.replaceState(globalThis.history.state, '', url)
}

/** Whether this load skips every custom extension. */
export function isSafeExtensionBootActive(): boolean {
  return safeBootCaptured || isSafeExtensionBoot(globalThis.location.search)
}

export function shouldLoadCustomNodeScript(
  script: string,
  {
    isCloudBuild,
    disabledExtensionPaths = [],
    disableAllCustomExtensions = false
  }: {
    isCloudBuild: boolean
    disabledExtensionPaths?: readonly string[]
    disableAllCustomExtensions?: boolean
  }
): boolean {
  if (script.includes('extensions/core')) return false
  if (isCloudBuild && INLINED_CLOUD_EXTENSIONS.has(script)) return false
  if (disableAllCustomExtensions) return false

  const extensionPath = getExtensionPath(script)
  return (
    extensionPath === undefined ||
    !disabledExtensionPaths.includes(extensionPath)
  )
}

const MAX_CUSTOM_NODE_PATH_LENGTH = 512
const MAX_CUSTOM_NODE_DIAGNOSTIC_LENGTH = 2048
const MAX_REPORTED_FAILURES = 10

export interface CustomNodeLoadFailure {
  ext: string
  error: unknown
}

function toFailureDiagnostic({
  ext,
  error
}: CustomNodeLoadFailure): CustomNodeFailureDiagnostic {
  const path = ext.slice(0, MAX_CUSTOM_NODE_PATH_LENGTH)
  try {
    return {
      ext: path,
      message: (getErrorMessage(error) ?? toError(error).message).slice(
        0,
        MAX_CUSTOM_NODE_DIAGNOSTIC_LENGTH
      ),
      stack:
        error instanceof Error
          ? error.stack?.slice(0, MAX_CUSTOM_NODE_DIAGNOSTIC_LENGTH)
          : undefined
    }
  } catch {
    return { ext: path, message: 'Unknown extension load failure' }
  }
}

function importModule(url: string): Promise<unknown> {
  return import(/* @vite-ignore */ url)
}

async function importCustomNodeScript(
  ext: string,
  { late = false, retry = false } = {}
): Promise<CustomNodeLoadFailure | undefined> {
  const base = api.fileURL(ext)
  const url = retry ? `${base}${base.includes('?') ? '&' : '?'}retry=1` : base
  try {
    await (late
      ? importNoticingFetchFailure(url, importModule)
      : importModule(url))
  } catch (error) {
    return { ext, error }
  }
}

export function reportCustomNodeLoadFailures(
  failures: CustomNodeLoadFailure[]
): void {
  if (failures.length === 0) return

  const reportedFailures = failures
    .slice(0, MAX_REPORTED_FAILURES)
    .map(toFailureDiagnostic)
  const errors = reportedFailures.map(({ message, stack }) =>
    Object.assign(new Error(message), stack ? { stack } : {})
  )
  const aggregate = new AggregateError(errors, 'Error loading extensions')
  aggregate.stack = `${aggregate.stack ?? aggregate.message}\nFailed extensions: ${reportedFailures.map(({ ext }) => ext).join(', ')}`

  reportError(aggregate, {
    errorType: CUSTOM_NODE_LOAD_ERROR_TYPE,
    surface: 'platform',
    level: 'warning',
    tags: { failed_extension_count: failures.length },
    context: {
      failures: reportedFailures,
      ...(failures.length > MAX_REPORTED_FAILURES && {
        [CUSTOM_NODE_FAILURES_TRUNCATED_FIELD]: true
      })
    }
  })
}

/**
 * Imports the custom node scripts among `servedScripts` in parallel and reports the failures.
 * With a CPU server reading, scripts that miss the deadline turn on late until `signal` aborts.
 */
export async function loadCustomNodeScripts(
  servedScripts: string[],
  signal: AbortSignal,
  firstCpuServerReading: Promise<CpuServerReading> | undefined,
  {
    disabledExtensionPaths = [],
    disableAllCustomExtensions = false
  }: {
    disabledExtensionPaths?: readonly string[]
    disableAllCustomExtensions?: boolean
  } = {}
) {
  const scripts = servedScripts.filter((script) =>
    shouldLoadCustomNodeScript(script, {
      isCloudBuild: __DISTRIBUTION__ === 'cloud',
      disabledExtensionPaths,
      disableAllCustomExtensions
    })
  )
  if (firstCpuServerReading) {
    await bootstrapTracer.settle('bootstrap/extensions-load-custom', () =>
      loadCustomNodesWithDeadline(
        scripts,
        {
          importScript: (ext, { retry } = {}) =>
            importCustomNodeScript(ext, { late: true, retry }),
          reportFailures: reportCustomNodeLoadFailures
        },
        signal,
        firstCpuServerReading
      )
    )
    return
  }
  const outcomes = await bootstrapTracer.settle(
    'bootstrap/extensions-load-custom',
    () => Promise.all(scripts.map((ext) => importCustomNodeScript(ext)))
  )
  reportCustomNodeLoadFailures(outcomes.filter((outcome) => !!outcome))
}
