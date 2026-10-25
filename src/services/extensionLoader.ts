import { installTouchPointerGuards } from '@/extensions/core/touchPointerGuards'
import { t } from '@/i18n'
import {
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
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'
import { installErrorNodeWidgets } from '@/scripts/errorNodeWidgets'
import { useExtensionStore } from '@/stores/extensionStore'
import { useToast } from '@/components/ui/toast/toastStore'
import {
  disableAgentExtensions,
  showAgentExtensionSettings
} from '@/platform/settings/agentExtensionService'
import { getErrorMessage, toError } from '@/utils/errorUtil'

const INLINED_CLOUD_EXTENSIONS = new Set([
  '/extensions/cloud/rum.js',
  '/extensions/cloud/sentry.js'
])

function getExtensionPackPath(extension: string): string | undefined {
  try {
    const pathname = new URL(extension, window.location.href).pathname
    return pathname.match(/^\/extensions\/[^/]+\//)?.[0]
  } catch {
    return undefined
  }
}

export function shouldLoadExtension(
  extension: string,
  {
    isCloudBuild,
    disabledPackPaths = [],
    disableAllCustomExtensions = false
  }: {
    isCloudBuild: boolean
    disabledPackPaths?: readonly string[]
    disableAllCustomExtensions?: boolean
  }
): boolean {
  if (extension.includes('extensions/core')) return false
  if (isCloudBuild && INLINED_CLOUD_EXTENSIONS.has(extension)) return false
  if (disableAllCustomExtensions) return false

  const packPath = getExtensionPackPath(extension)
  return packPath === undefined || !disabledPackPaths.includes(packPath)
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

export async function notifyNewAgentExtensions() {
  const extensionStore = useExtensionStore()
  const settingStore = useSettingStore()
  const seenNames = settingStore.get('Comfy.Extension.SeenAgentExtensions')
  const seen = new Set(seenNames)
  const unseen = extensionStore.agentExtensions.filter(
    (extension) => !seen.has(extension.name)
  )
  if (unseen.length === 0) return

  const [first] = unseen
  const title =
    unseen.length === 1
      ? t('g.agentExtensionAdded', { name: first.name })
      : t('g.agentExtensionsAdded', { count: unseen.length })
  useToast().info(title, {
    description: unseen.length === 1 ? first.provenance?.summary : undefined,
    actions: [
      { label: t('g.manage'), onClick: showAgentExtensionSettings },
      {
        label: t('g.disable'),
        onClick: () => {
          void disableAgentExtensions(unseen)
        }
      }
    ]
  })

  const result = await settingStore.setOrRevert(
    'Comfy.Extension.SeenAgentExtensions',
    [
      ...new Set([
        ...seenNames,
        ...extensionStore.agentExtensions.map((x) => x.name)
      ])
    ]
  )
  if (!result.ok) {
    reportError(result.detail, {
      errorType: 'failure_recording_seen_agent_extensions',
      surface: 'platform',
      level: 'warning',
      tags: { reason: result.reason },
      context: { unseen_extension_count: unseen.length }
    })
  }
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
  extensionStore.loadBootDisabledExtensionNames(
    settingStore.get('Comfy.Extension.Disabled')
  )
  const disabledPackPaths = settingStore.get('Comfy.Extension.DisabledPacks')
  const disableAllCustomExtensions = new URLSearchParams(
    window.location.search
  ).has('safe')

  const extensions = await api.getExtensions()
  extensionStore.loadExtensionPackPaths(
    extensions
      .filter((extension) =>
        shouldLoadExtension(extension, {
          isCloudBuild: __DISTRIBUTION__ === 'cloud'
        })
      )
      .flatMap((extension) => {
        const packPath = getExtensionPackPath(extension)
        return packPath === undefined ? [] : [packPath]
      }),
    disabledPackPaths
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
      disabledPackPaths,
      disableAllCustomExtensions
    })
  )
  if (lateLoadingApplies()) {
    await bootstrapTracer.settle('bootstrap/extensions-load-custom', () =>
      loadCustomExtensionsWithDeadline(
        customExtensions,
        {
          importScript: importCustomExtension,
          reportFailures: reportExtensionLoadFailures
        },
        signal
      )
    )
  } else {
    const outcomes = await bootstrapTracer.settle(
      'bootstrap/extensions-load-custom',
      () =>
        Promise.all(customExtensions.map((ext) => importCustomExtension(ext)))
    )
    reportExtensionLoadFailures(outcomes.filter((outcome) => !!outcome))
  }
  void notifyNewAgentExtensions().catch((cause) => {
    reportError(cause, {
      errorType: 'failure_recording_seen_agent_extensions',
      surface: 'platform'
    })
  })
}
