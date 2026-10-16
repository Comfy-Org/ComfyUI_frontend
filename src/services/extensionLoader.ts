import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import { getErrorMessage, toError } from '@/utils/errorUtil'

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

const MAX_EXTENSION_PATH_LENGTH = 512
const MAX_EXTENSION_DIAGNOSTIC_LENGTH = 4096
const MAX_REPORTED_FAILURES = 10

export interface ExtensionLoadFailure {
  ext: string
  error: unknown
}

interface ExtensionFailureDiagnostic {
  ext: string
  message: string
  stack?: string
}

function normalizeFailure(error: unknown): {
  normalized: Error
  retainStack: boolean
} {
  try {
    const message = getErrorMessage(error)
    if (message) {
      const retainStack = error instanceof Error
      return {
        normalized: retainStack ? error : new Error(message),
        retainStack
      }
    }
    const normalized = toError(error)
    return {
      normalized: getErrorMessage(normalized)
        ? normalized
        : new Error('Unknown extension load failure'),
      retainStack: false
    }
  } catch {
    return {
      normalized: new Error('Unknown extension load failure'),
      retainStack: false
    }
  }
}

function truncateExtensionPath(ext: string): string {
  return ext.slice(0, MAX_EXTENSION_PATH_LENGTH)
}

function toFailureDiagnostic({
  ext,
  error
}: ExtensionLoadFailure): ExtensionFailureDiagnostic {
  const { normalized, retainStack } = normalizeFailure(error)

  return {
    ext: truncateExtensionPath(ext),
    message: normalized.message.slice(0, MAX_EXTENSION_DIAGNOSTIC_LENGTH),
    stack: retainStack
      ? normalized.stack?.slice(0, MAX_EXTENSION_DIAGNOSTIC_LENGTH)
      : undefined
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
