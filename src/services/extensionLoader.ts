import { useSettingStore } from '@/platform/settings/settingStore'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { useExtensionStore } from '@/stores/extensionStore'
import { getErrorMessage } from '@/utils/errorUtil'

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

const MAX_NAMED_FAILED_EXTENSIONS = 10

export interface ExtensionLoadFailure {
  ext: string
  error: unknown
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
 * The paths go in the message because `reportError` writes its console line
 * from the error, not from `options.tags`. The count is tagged; backend paths
 * are unbounded and belong in context instead of an indexed facet.
 */
export function reportExtensionLoadFailures(
  failures: ExtensionLoadFailure[]
): void {
  if (failures.length === 0) return

  const named = failures.slice(0, MAX_NAMED_FAILED_EXTENSIONS)
  const elided = failures.length - named.length
  const paths = named.map(({ ext }) => ext).join(', ')
  const noun = failures.length === 1 ? 'extension' : 'extensions'

  reportError(
    new Error(
      `Error loading ${failures.length} ${noun}: ${paths}` +
        (elided > 0 ? ` (+${elided} more)` : ''),
      { cause: failures[0].error }
    ),
    {
      errorType: 'error_loading_extension',
      surface: 'platform',
      level: 'warning',
      tags: { failed_extension_count: failures.length },
      context: {
        failures: named.map(({ ext, error }) => ({
          ext,
          message: getErrorMessage(error)
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
