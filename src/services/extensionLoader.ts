import { installTouchPointerGuards } from '@/extensions/core/touchPointerGuards'
import { askCpuServer } from '@/platform/lateCustomNodes/cpuServerStep'
import {
  importNoticingFetchFailure,
  lateLoadingApplies,
  loadCustomExtensionsWithDeadline
} from '@/platform/lateCustomNodes/lateLoading'
import { useSettingStore } from '@/platform/settings/settingStore'
import {
  EXTENSION_FAILURES_TRUNCATED_FIELD,
  EXTENSION_LOAD_ERROR_TYPE
} from '@/platform/telemetry/extensionLoadTelemetry'
import type { ExtensionFailureDiagnostic } from '@/platform/telemetry/extensionLoadTelemetry'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@comfyorg/telemetry/reportError'
import { api } from '@/scripts/api'
import { installErrorNodeWidgets } from '@/scripts/errorNodeWidgets'
import { useExtensionStore } from '@/stores/extensionStore'
import {
  getErrorMessage,
  toError
} from '@comfyorg/shared-frontend-utils/errorUtil'

const INLINED_CLOUD_EXTENSIONS = new Set([
  '/extensions/cloud/rum.js',
  '/extensions/cloud/sentry.js'
])

function getExtensionPath(extension: string): string | undefined {
  try {
    const pathname = new URL(extension, window.location.href).pathname
    return pathname.match(/^\/extensions\/[^/]+\//)?.[0]
  } catch {
    return undefined
  }
}

export function isSafeExtensionBoot(search: string): boolean {
  const value = new URLSearchParams(search).get('safe')
  return value === '' || value === '1' || value === 'true'
}

export function shouldLoadExtension(
  extension: string,
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
  if (extension.includes('extensions/core')) return false
  if (isCloudBuild && INLINED_CLOUD_EXTENSIONS.has(extension)) return false
  if (disableAllCustomExtensions) return false

  const extensionPath = getExtensionPath(extension)
  return (
    extensionPath === undefined ||
    !disabledExtensionPaths.includes(extensionPath)
  )
}

const MAX_EXTENSION_PATH_LENGTH = 512
const MAX_EXTENSION_DIAGNOSTIC_LENGTH = 2048
const MAX_REPORTED_FAILURES = 10

export interface ExtensionLoadFailure {
  ext: string
  error: unknown
}

function toFailureDiagnostic({
  ext,
  error
}: ExtensionLoadFailure): ExtensionFailureDiagnostic {
  const path = ext.slice(0, MAX_EXTENSION_PATH_LENGTH)
  try {
    return {
      ext: path,
      message: (getErrorMessage(error) ?? toError(error).message).slice(
        0,
        MAX_EXTENSION_DIAGNOSTIC_LENGTH
      ),
      stack:
        error instanceof Error
          ? error.stack?.slice(0, MAX_EXTENSION_DIAGNOSTIC_LENGTH)
          : undefined
    }
  } catch {
    return { ext: path, message: 'Unknown extension load failure' }
  }
}

function importModule(url: string): Promise<unknown> {
  return import(/* @vite-ignore */ url)
}

async function importCustomExtension(
  ext: string,
  { late = false, retry = false } = {}
): Promise<ExtensionLoadFailure | undefined> {
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

export function reportExtensionLoadFailures(
  failures: ExtensionLoadFailure[]
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
    errorType: EXTENSION_LOAD_ERROR_TYPE,
    surface: 'platform',
    level: 'warning',
    tags: { failed_extension_count: failures.length },
    context: {
      failures: reportedFailures,
      ...(failures.length > MAX_REPORTED_FAILURES && {
        [EXTENSION_FAILURES_TRUNCATED_FIELD]: true
      })
    }
  })
}

/**
 * Loads the core extensions, then every extension served by the backend, in
 * parallel. Core extensions load first because custom extensions may depend
 * on them. Late custom extensions stop turning on when `signal` aborts.
 */
export async function loadExtensions(
  signal: AbortSignal = new AbortController().signal
) {
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  extensionStore.loadDisabledExtensionNames(
    settingStore.get('Comfy.Extension.Disabled')
  )
  const disabledExtensionPaths = settingStore.get(
    'Comfy.Extension.DisabledPacks'
  )
  const disableAllCustomExtensions = isSafeExtensionBoot(window.location.search)

  const firstCpuServerReading = lateLoadingApplies()
    ? askCpuServer()
    : undefined
  const extensions = await api.getExtensions()
  extensionStore.loadExtensionPaths(
    extensions
      .filter((extension) =>
        shouldLoadExtension(extension, {
          isCloudBuild: __DISTRIBUTION__ === 'cloud'
        })
      )
      .flatMap((extension) => {
        const extensionPath = getExtensionPath(extension)
        return extensionPath === undefined ? [] : [extensionPath]
      }),
    disabledExtensionPaths
  )

  installErrorNodeWidgets()
  installTouchPointerGuards()
  await bootstrapTracer.settle('bootstrap/extensions-load-core', async () => {
    const { registerCoreExtensions } = await import('@/extensions/core/index')
    await registerCoreExtensions()
  })
  extensionStore.captureCoreExtensions()
  const customExtensions = extensions.filter((extension) =>
    shouldLoadExtension(extension, {
      isCloudBuild: __DISTRIBUTION__ === 'cloud',
      disabledExtensionPaths,
      disableAllCustomExtensions
    })
  )
  if (firstCpuServerReading) {
    await bootstrapTracer.settle('bootstrap/extensions-load-custom', () =>
      loadCustomExtensionsWithDeadline(
        customExtensions,
        {
          importScript: (ext, { retry } = {}) =>
            importCustomExtension(ext, { late: true, retry }),
          reportFailures: reportExtensionLoadFailures
        },
        signal,
        firstCpuServerReading
      )
    )
    return
  }
  const outcomes = await bootstrapTracer.settle(
    'bootstrap/extensions-load-custom',
    () => Promise.all(customExtensions.map((ext) => importCustomExtension(ext)))
  )
  reportExtensionLoadFailures(outcomes.filter((outcome) => !!outcome))
}
