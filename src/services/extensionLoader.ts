import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import { toError } from '@/utils/errorUtil'

const INLINED_CLOUD_EXTENSIONS = new Set([
  '/extensions/cloud/rum.js',
  '/extensions/cloud/sentry.js'
])

export function shouldLoadExtension(
  extension: string,
  isCloudBuild: boolean
): boolean {
  if (extension.includes('extensions/core')) return false
  return !isCloudBuild || !INLINED_CLOUD_EXTENSIONS.has(extension)
}

const MAX_EXTENSION_PATH_LENGTH = 256
const MAX_EXTENSION_DIAGNOSTIC_LENGTH = 4096
const MAX_NAMED_FAILED_EXTENSIONS = 10

export interface ExtensionLoadFailure {
  ext: string
  error: unknown
}

function safeToError(value: unknown): Error {
  try {
    return toError(value)
  } catch {
    return new Error('Unknown extension load failure')
  }
}

function readErrorDetail(
  value: unknown,
  key: 'message' | 'stack'
): string | undefined {
  try {
    const detail = value instanceof Error ? value[key] : undefined
    return typeof detail === 'string'
      ? detail.slice(0, MAX_EXTENSION_DIAGNOSTIC_LENGTH)
      : undefined
  } catch {
    return undefined
  }
}

function truncateExtensionPath(ext: string): string {
  if (ext.length <= MAX_EXTENSION_PATH_LENGTH) return ext
  const limit = ext.lastIndexOf('/', MAX_EXTENSION_PATH_LENGTH)
  return ext.slice(0, Math.max(limit, MAX_EXTENSION_PATH_LENGTH))
}

/**
 * Import one backend-provided extension, returning the failure rather than
 * throwing, so one broken pack cannot abort the rest of the parallel load.
 *
 * Reporting deliberately does not happen here. A systemic failure — a backend
 * restart, or a proxy serving HTML for every `.js` — fails every import in the
 * list, and one report per extension is then unbounded. Off cloud that is
 * actively harmful: with no sink live, each report is held in `reportError`'s
 * 25-entry pending buffer, so a handful of broken packs during bootstrap would
 * silently crowd out every later error in the session. The batch is reported
 * once, by `reportExtensionLoadFailures`.
 */
async function importCustomExtension(
  ext: string
): Promise<ExtensionLoadFailure | undefined> {
  try {
    await import(/* @vite-ignore */ api.fileURL(ext))
  } catch (error) {
    return { ext, error }
  }
}

/**
 * Keep the error message stable so Sentry and Datadog group systemic failures
 * together. The bounded paths and original stacks stay in context, where they
 * remain available for diagnosing the individual failed extension.
 */
export function reportExtensionLoadFailures(
  failures: ExtensionLoadFailure[]
): void {
  if (failures.length === 0) return

  const noun = failures.length === 1 ? 'extension' : 'extensions'
  const errors = failures.map(({ error }) => safeToError(error))
  const reportedFailures = failures.slice(0, MAX_NAMED_FAILED_EXTENSIONS)

  reportError(
    new AggregateError(errors, `Error loading ${failures.length} ${noun}`),
    {
      errorType: 'error_loading_extension',
      surface: 'platform',
      level: 'warning',
      tags: { failed_extension_count: failures.length },
      context: {
        failures: reportedFailures.map(({ ext }, index) => ({
          ext: truncateExtensionPath(ext),
          message:
            readErrorDetail(failures[index].error, 'message') ??
            readErrorDetail(errors[index], 'message') ??
            'Unknown extension load failure',
          stack:
            readErrorDetail(failures[index].error, 'stack') ??
            readErrorDetail(errors[index], 'stack')
        }))
      }
    }
  )
}

/**
 * Loads the core extensions, then every extension served by the backend, in
 * parallel. Core extensions load first because custom extensions may depend
 * on them.
 */
export async function loadExtensions() {
  const extensionStore = useExtensionStore()
  extensionStore.loadDisabledExtensionNames(
    useSettingStore().get('Comfy.Extension.Disabled')
  )

  const extensions = await api.getExtensions()

  await bootstrapTracer.settle(
    'bootstrap/extensions-load-core',
    () => import('@/extensions/core/index')
  )
  extensionStore.captureCoreExtensions()
  const outcomes = await bootstrapTracer.settle(
    'bootstrap/extensions-load-custom',
    () =>
      Promise.all(
        extensions
          .filter((extension) =>
            shouldLoadExtension(extension, __DISTRIBUTION__ === 'cloud')
          )
          .map((ext) => importCustomExtension(ext))
      )
  )
  reportExtensionLoadFailures(outcomes.filter((outcome) => !!outcome))
}
