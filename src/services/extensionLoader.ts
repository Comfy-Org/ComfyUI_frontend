import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
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

interface ExtensionFailureDiagnostic {
  ext: string
  message: string
  stack?: string
}

function readStringProperty(
  value: object,
  property: string
): string | undefined {
  try {
    const result = Reflect.get(value, property)
    return typeof result === 'string' ? result : undefined
  } catch {
    return undefined
  }
}

function readFailureMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (typeof error === 'object' && error !== null) {
    const message = readStringProperty(error, 'message')
    if (message) return message
    if (error instanceof Error) return 'Unknown extension load failure'
  }

  try {
    const serialized = JSON.stringify(error)
    if (typeof serialized === 'string') return serialized
  } catch {
    return 'Unknown extension load failure'
  }

  try {
    return String(error)
  } catch {
    return 'Unknown extension load failure'
  }
}

function truncateExtensionPath(ext: string): string {
  if (ext.length <= MAX_EXTENSION_PATH_LENGTH) return ext
  const limit = ext.lastIndexOf('/', MAX_EXTENSION_PATH_LENGTH)
  return ext.slice(0, Math.max(limit, MAX_EXTENSION_PATH_LENGTH))
}

function toFailureDiagnostic({
  ext,
  error
}: ExtensionLoadFailure): ExtensionFailureDiagnostic {
  const stack =
    error instanceof Error ? readStringProperty(error, 'stack') : undefined

  return {
    ext: truncateExtensionPath(ext),
    message: readFailureMessage(error).slice(
      0,
      MAX_EXTENSION_DIAGNOSTIC_LENGTH
    ),
    stack: stack?.slice(0, MAX_EXTENSION_DIAGNOSTIC_LENGTH)
  }
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
  const reportedFailures = failures
    .slice(0, MAX_NAMED_FAILED_EXTENSIONS)
    .map(toFailureDiagnostic)
  const errors = reportedFailures.map(({ message }) => new Error(message))
  const aggregate = new AggregateError(
    errors,
    `Error loading ${failures.length} ${noun}`
  )
  aggregate.stack = `${aggregate.stack ?? aggregate.message}\nFailed extensions: ${reportedFailures.map(({ ext }) => ext).join(', ')}`

  reportError(aggregate, {
    errorType: 'error_loading_extension',
    surface: 'platform',
    level: 'warning',
    tags: { failed_extension_count: failures.length },
    context: {
      failures: reportedFailures
    }
  })
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
